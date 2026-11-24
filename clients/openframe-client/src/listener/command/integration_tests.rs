use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex};

use futures::StreamExt;
use serde_json::json;
use tempfile::TempDir;
use tokio::sync::Notify;
use tokio::time::{timeout, Duration};

use super::{
    Begin, ClientUpdateHandler, CommandContext, CommandHandler, CommandListener,
    FeatureFlagsHandler, Outcome, PackageAdoptHandler, PackageUpdateHandler, RestartGate,
    ToolInstallationHandler, ToolUpdateHandler,
};
use crate::clients::ToolApiClient;
use crate::config::update_config::DEV_CLIENT_VERSION;
use crate::models::{
    DeliveryRef, DeliveryResult, DeliveryResultMessage, FailReason, Feature, FeatureFlagsState,
    Installation, InstalledAsset, InstalledTool, OpenFrameClientUpdateMessage, PackageRef,
    PackageUpdateStatusMessage, ToolRecordState, UpdateStatus,
};
use crate::platform::{DirectoryManager, DmgExtractor};
use crate::services::delivery_results::DeliveryResults;
use crate::services::execution_service::ExecutionService;
use crate::services::feature_flags_service::FeatureFlagsService;
use crate::services::installed_agent_message_publisher::InstalledAgentMessagePublisher;
use crate::services::last_known_good_service::LastKnownGoodService;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::openframe_client_info_service::OpenFrameClientInfoService;
use crate::services::openframe_client_update_service::OpenFrameClientUpdateService;
use crate::services::package_manager::adopt::PackageAdoptRunner;
use crate::services::package_manager::brew::BrewLock;
use crate::services::package_manager::package_update::{
    OrderStore, RestartSignals, StatusReporter,
};
use crate::services::package_manager::{is_supported, ManagerId};
use crate::services::result_outbox_run_manager::ResultOutboxRunManager;
use crate::services::result_store::{LedgerState, ResultStore};
use crate::services::tool_agent_update_service::ToolAgentUpdateService;
use crate::services::tool_run_manager::ToolRunManager;
use crate::services::update_cleanup_service::UpdateCleanupService;
use crate::services::update_handler_service::UpdateHandlerService;
use crate::services::update_state_service::UpdateStateService;
use crate::services::{
    AgentConfigurationService, GithubDownloadService, InitialConfigurationService,
    InstalledToolsService, ToolCommandParamsResolver, ToolConnectionMessagePublisher,
    ToolConnectionProcessingManager, ToolConnectionService, ToolInstallationService,
    ToolKillService, ToolOps, ToolUrlParamsResolver,
};
use crate::test_support::{connection_manager, NatsServer};
use crate::utils::in_progress::InProgress;
use crate::utils::latch::Latch;
use openframe_common::protocol::InstalledAgentMessage;

const MACHINE: &str = "it-machine";
const BOUND: Duration = Duration::from_secs(10);
const QUIET: Duration = Duration::from_millis(500);
const PROBE: &str = "probe";
const VERSION: &str = "1.5.1";

struct Agent {
    _server: NatsServer,
    dir: TempDir,
    directories: DirectoryManager,
    tester: async_nats::Client,
    results: async_nats::Subscriber,
    unclaimed: Vec<DeliveryResultMessage>,
    manager: NatsConnectionManager,
    config: AgentConfigurationService,
    tool_ops: ToolOps,
    tool_run_manager: ToolRunManager,
    publisher: NatsMessagePublisher,
    store: Arc<ResultStore>,
    flush: Arc<Notify>,
    flags_path: PathBuf,
    version: String,
}

impl Agent {
    async fn start() -> Option<(Self, RestartGate)> {
        Self::start_as(VERSION).await
    }

    async fn start_as(version: &str) -> Option<(Self, RestartGate)> {
        let server = NatsServer::start()?;
        let dir = tempfile::tempdir().unwrap();
        let directories = DirectoryManager::with_custom_dirs(
            dir.path().join("logs"),
            dir.path().join("app"),
            dir.path().join("secured"),
        );
        let config = AgentConfigurationService::new(directories.clone()).unwrap();
        config
            .save_registration_data(MACHINE.into(), "client".into(), "secret".into())
            .await
            .unwrap();
        let initial = InitialConfigurationService::new(directories.clone()).unwrap();
        let tool_ops = ToolOps::default();
        let tool_run_manager = ToolRunManager::new(
            InstalledToolsService::new(directories.clone()).unwrap(),
            ToolCommandParamsResolver::new(directories.clone(), initial.clone(), config.clone()),
            ToolKillService::new(),
            tool_ops.clone(),
        );
        let manager = connection_manager(server.url(), &directories, &config);
        manager.use_client_for_tests(async_nats::connect(server.url()).await.unwrap());

        let tester = async_nats::connect(server.url()).await.unwrap();
        async_nats::jetstream::new(tester.clone())
            .create_stream(async_nats::jetstream::stream::Config {
                name: "DELIVERY_RESULT".into(),
                subjects: vec!["machine.*.delivery.result".into()],
                ..Default::default()
            })
            .await
            .unwrap();
        let results = tester
            .subscribe(format!("machine.{MACHINE}.delivery.result"))
            .await
            .unwrap();
        tester.flush().await.unwrap();

        let publisher = NatsMessagePublisher::new(manager.clone());
        let store = Arc::new(ResultStore::open_or_degrade(
            directories.secured_dir().join("scheduled_outbox.redb"),
        ));
        let flush = Arc::new(Notify::new());
        ResultOutboxRunManager::new(store.clone(), Arc::new(publisher.clone()), flush.clone())
            .start();

        let mut agent = Self {
            _server: server,
            flags_path: directories.secured_dir().join("feature_flags.json"),
            version: version.to_string(),
            dir,
            directories,
            tester,
            results,
            unclaimed: Vec::new(),
            manager,
            config,
            tool_ops,
            tool_run_manager,
            publisher,
            store,
            flush,
        };
        let (gate, _service) = agent.launch().await;
        Some((agent, gate))
    }

    fn context(&self) -> (RestartGate, CommandContext) {
        let gate = RestartGate::new(
            ToolOps::default().busy_tools(),
            ExecutionService::new().running_scripts(),
            self.tool_run_manager.client_update_pending(),
            InProgress::default().view(),
            Latch::default(),
        );
        let context = CommandContext::new(
            self.manager.clone(),
            self.config.clone(),
            gate.clone(),
            DeliveryResults::new(
                self.publisher.clone(),
                self.store.clone(),
                self.flush.clone(),
            ),
            self.store.clone(),
            self.flush.clone(),
        );
        (gate, context)
    }

    async fn launch(&mut self) -> (RestartGate, Arc<FeatureFlagsService>) {
        let (gate, context) = self.context();
        let service = Arc::new(FeatureFlagsService::load(
            self.flags_path.clone(),
            self.version.clone(),
        ));
        CommandListener::new(FeatureFlagsHandler::new(service.clone()), context)
            .start()
            .await
            .unwrap();
        self.until_listening().await;
        (gate, service)
    }

    async fn launch_as(&mut self, version: &str) -> (RestartGate, Arc<FeatureFlagsService>) {
        self.version = version.to_string();
        self.launch().await
    }

    async fn until_listening(&mut self) {
        timeout(BOUND, async {
            loop {
                self.send(command(PROBE, Some(0), json!({}))).await;
                if timeout(Duration::from_millis(200), self.next_result(PROBE))
                    .await
                    .is_ok()
                {
                    return;
                }
            }
        })
        .await
        .expect("the flags listener never answered");
    }

    async fn launch_fake(&mut self) -> FakeHandler {
        self.launch_command(FakeHandler::default()).await
    }

    async fn launch_command<H: CommandHandler>(&mut self, handler: H) -> H {
        self.launch_command_gated(handler).await.0
    }

    async fn launch_command_gated<H: CommandHandler>(&mut self, handler: H) -> (H, RestartGate) {
        let (gate, context) = self.context();
        CommandListener::new(handler.clone(), context)
            .start()
            .await
            .unwrap();
        // a probe id of its own, so a late answer to another listener's probe cannot pass for this one
        let probe = format!("{PROBE}-{}", H::KIND);
        timeout(BOUND, async {
            loop {
                self.send_to(H::subject(MACHINE), fake(&probe, Some(0), "done"))
                    .await;
                if timeout(Duration::from_millis(200), self.next_result(&probe))
                    .await
                    .is_ok()
                {
                    return;
                }
            }
        })
        .await
        .expect("the fake listener never answered");
        (handler, gate)
    }

    async fn send(&self, payload: serde_json::Value) {
        self.send_to(format!("machine.{MACHINE}.feature-flags"), payload)
            .await;
    }

    async fn send_fake(&self, payload: serde_json::Value) {
        self.send_to(FakeHandler::subject(MACHINE), payload).await;
    }

    async fn send_to(&self, subject: String, payload: serde_json::Value) {
        self.tester
            .publish(subject, serde_json::to_vec(&payload).unwrap().into())
            .await
            .unwrap();
        self.tester.flush().await.unwrap();
    }

    async fn next_result(&mut self, dispatch_id: &str) -> DeliveryResultMessage {
        if let Some(index) = self
            .unclaimed
            .iter()
            .position(|result| result.delivery.dispatch_id == dispatch_id)
        {
            return self.unclaimed.remove(index);
        }
        loop {
            let message = self
                .results
                .next()
                .await
                .expect("result subscription ended");
            let result: DeliveryResultMessage = serde_json::from_slice(&message.payload).unwrap();
            if result.delivery.dispatch_id == dispatch_id {
                return result;
            }
            self.unclaimed.push(result);
        }
    }

    async fn expect(
        &mut self,
        dispatch_id: &str,
        expected: DeliveryResult,
    ) -> DeliveryResultMessage {
        let result = timeout(BOUND, self.next_result(dispatch_id))
            .await
            .unwrap_or_else(|_| panic!("no {expected:?} for {dispatch_id}"));
        assert_eq!(result.result, expected, "{dispatch_id}: {result:?}");
        result
    }

    async fn expect_silence(&mut self, dispatch_id: &str) {
        let heard = timeout(QUIET, self.next_result(dispatch_id)).await;
        assert!(
            heard.is_err(),
            "unexpected result for {dispatch_id}: {heard:?}"
        );
    }

    async fn until_flushed(&self) {
        timeout(BOUND, async {
            while self.store.len().await.unwrap() > 0 {
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await
        .expect("the outbox never drained");
    }

    fn client_update_service(&self) -> OpenFrameClientUpdateService {
        let update_state = UpdateStateService::new(self.directories.clone()).unwrap();
        let client_info = OpenFrameClientInfoService::new(self.directories.clone()).unwrap();
        let last_known_good = LastKnownGoodService::new(self.directories.clone()).unwrap();
        let update_handler = UpdateHandlerService::new(
            update_state.clone(),
            client_info.clone(),
            UpdateCleanupService::for_binary(self.dir.path().join("openframe-client")),
            last_known_good.clone(),
            InstalledAgentMessagePublisher::new(self.publisher.clone()),
            self.config.clone(),
            self.store.clone(),
        );
        OpenFrameClientUpdateService::new(
            client_info,
            GithubDownloadService::new(reqwest::Client::new(), DmgExtractor::new()),
            update_state,
            last_known_good,
            self.tool_run_manager.clone(),
            self.tool_ops.clone(),
            InProgress::default().view(),
            update_handler,
        )
    }

    fn persisted(&self) -> FeatureFlagsState {
        serde_json::from_slice(&std::fs::read(&self.flags_path).unwrap()).unwrap()
    }

    fn tool_update_service(&self) -> ToolAgentUpdateService {
        let initial = InitialConfigurationService::new(self.directories.clone()).unwrap();
        ToolAgentUpdateService::new(
            GithubDownloadService::new(reqwest::Client::new(), DmgExtractor::new()),
            InstalledToolsService::new(self.directories.clone()).unwrap(),
            ToolKillService::new(),
            self.tool_run_manager.clone(),
            self.directories.clone(),
            self.config.clone(),
            InstalledAgentMessagePublisher::new(self.publisher.clone()),
            ToolCommandParamsResolver::new(self.directories.clone(), initial, self.config.clone()),
        )
    }

    fn tool_installation_service(&self) -> ToolInstallationService {
        let initial = InitialConfigurationService::new(self.directories.clone()).unwrap();
        let resolver = ToolCommandParamsResolver::new(
            self.directories.clone(),
            initial.clone(),
            self.config.clone(),
        );
        let installed_tools = InstalledToolsService::new(self.directories.clone()).unwrap();
        let connections = ToolConnectionService::new(self.directories.clone()).unwrap();
        ToolInstallationService::new(
            GithubDownloadService::new(reqwest::Client::new(), DmgExtractor::new()),
            ToolApiClient::new(
                reqwest::Client::new(),
                "http://127.0.0.1:9".into(),
                self.config.clone(),
            ),
            resolver.clone(),
            ToolUrlParamsResolver::new(initial),
            installed_tools.clone(),
            self.directories.clone(),
            self.tool_run_manager.clone(),
            ToolConnectionProcessingManager::new(
                installed_tools,
                resolver,
                ToolConnectionMessagePublisher::new(self.publisher.clone()),
                self.config.clone(),
                connections.clone(),
                self.tool_ops.clone(),
            ),
            self.config.clone(),
            InstalledAgentMessagePublisher::new(self.publisher.clone()),
            connections,
        )
    }

    async fn install_tool(&self, tool: InstalledTool) {
        let binary = self
            .directories
            .get_tool_executable_path(&tool.tool_agent_id, None);
        std::fs::create_dir_all(binary.parent().unwrap()).unwrap();
        std::fs::write(&binary, b"agent").unwrap();
        InstalledToolsService::new(self.directories.clone())
            .unwrap()
            .save(tool)
            .await
            .unwrap();
    }

    async fn installed_agents(&self) -> async_nats::Subscriber {
        async_nats::jetstream::new(self.tester.clone())
            .create_stream(async_nats::jetstream::stream::Config {
                name: "INSTALLED_AGENTS".into(),
                subjects: vec!["machine.*.installed-agent".into()],
                ..Default::default()
            })
            .await
            .unwrap();
        let reports = self
            .tester
            .subscribe(format!("machine.{MACHINE}.installed-agent"))
            .await
            .unwrap();
        self.tester.flush().await.unwrap();
        reports
    }
}

fn entry(value: bool, min_version: &str) -> serde_json::Value {
    json!({ "enabled": value, "minVersion": min_version })
}

async fn expect_no_restart(gate: &RestartGate) {
    let requested = timeout(QUIET, gate.requested()).await;
    assert!(requested.is_err(), "a restart was requested");
}

fn command(
    dispatch_id: &str,
    sequence: Option<i64>,
    flags: serde_json::Value,
) -> serde_json::Value {
    let mut delivery = json!({
        "type": "CLIENT_FEATURE_FLAGS",
        "targetId": "tenant",
        "dispatchId": dispatch_id,
    });
    if let Some(sequence) = sequence {
        delivery["sequence"] = json!(sequence);
    }
    json!({ "delivery": delivery, "flags": flags })
}

#[tokio::test]
async fn unchanged_flags_are_acked_done_and_persisted() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };

    agent
        .send(command(
            "d1",
            Some(1),
            json!({ "delivery-tool-installation": entry(false, "1.0.0") }),
        ))
        .await;

    agent.expect("d1", DeliveryResult::Acked).await;
    agent.expect("d1", DeliveryResult::Done).await;
    let persisted = agent.persisted();
    assert_eq!(persisted.sequence, 1);
    assert_eq!(persisted.awaiting_restart, None);
}

#[tokio::test]
async fn changed_flags_restart_and_the_next_process_reports_done() {
    let Some((mut agent, gate)) = Agent::start().await else {
        return;
    };

    agent
        .send(command(
            "d2",
            Some(2),
            json!({ "delivery-tool-installation": entry(true, "1.0.0") }),
        ))
        .await;

    agent.expect("d2", DeliveryResult::Acked).await;
    timeout(BOUND, gate.requested())
        .await
        .expect("restart was never requested");
    agent.expect_silence("d2").await;
    assert_eq!(
        agent
            .persisted()
            .awaiting_restart
            .map(|delivery| delivery.dispatch_id),
        Some("d2".to_string())
    );

    agent.launch().await;

    agent.expect("d2", DeliveryResult::Done).await;
    timeout(BOUND, async {
        while agent.persisted().awaiting_restart.is_some() {
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("the restart marker was never cleared");
}

#[tokio::test]
async fn commands_after_a_requested_restart_are_left_to_the_backend_retry() {
    let Some((mut agent, gate)) = Agent::start().await else {
        return;
    };
    agent
        .send(command(
            "d3",
            Some(3),
            json!({ "delivery-tool-installation": entry(true, "1.0.0") }),
        ))
        .await;
    timeout(BOUND, gate.requested())
        .await
        .expect("restart was never requested");

    agent
        .send(command(
            "d4",
            Some(4),
            json!({ "delivery-tool-installation": entry(false, "1.0.0") }),
        ))
        .await;

    agent.expect_silence("d4").await;
    assert_eq!(agent.persisted().sequence, 3);
}

#[tokio::test]
async fn stale_sequence_is_done_without_applying() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    agent.send(command("d5", Some(5), json!({}))).await;
    agent.expect("d5", DeliveryResult::Acked).await;
    agent.expect("d5", DeliveryResult::Done).await;

    agent
        .send(command(
            "d6",
            Some(4),
            json!({ "delivery-tool-installation": entry(false, "1.0.0") }),
        ))
        .await;

    agent.expect("d6", DeliveryResult::Acked).await;
    agent.expect("d6", DeliveryResult::Done).await;
    assert_eq!(agent.persisted().sequence, 5);
}

#[tokio::test]
async fn malformed_flags_fail_with_a_reason() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };

    for (dispatch_id, payload) in [
        ("d7", command("d7", Some(7), json!("not-a-map"))),
        ("d7-null", command("d7-null", Some(7), json!(null))),
        (
            "d7-missing",
            json!({ "delivery": { "type": "CLIENT_FEATURE_FLAGS", "targetId": "tenant", "dispatchId": "d7-missing", "sequence": 7 } }),
        ),
    ] {
        agent.send(payload).await;

        let failed = agent.expect(dispatch_id, DeliveryResult::Failed).await;
        assert!(
            failed.error.unwrap().contains("malformed payload"),
            "{dispatch_id}"
        );
    }
    assert!(!agent.flags_path.exists());
}

#[tokio::test]
async fn a_message_without_delivery_gets_no_answer() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };

    agent
        .send(json!({ "flags": { "delivery-tool-installation": entry(true, "1.0.0") } }))
        .await;
    agent
        .send(command(
            "d8",
            Some(8),
            json!({ "delivery-tool-installation": entry(false, "1.0.0") }),
        ))
        .await;

    let first = timeout(BOUND, async {
        loop {
            let message = agent.results.next().await.unwrap();
            let result: DeliveryResultMessage = serde_json::from_slice(&message.payload).unwrap();
            if result.delivery.dispatch_id != PROBE {
                return result;
            }
        }
    })
    .await
    .unwrap();
    assert_eq!(first.delivery.dispatch_id, "d8");
    assert_eq!(agent.persisted().sequence, 8);
}

#[tokio::test]
async fn flags_without_a_sequence_fail() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };

    agent
        .send(command(
            "d9",
            None,
            json!({ "delivery-tool-installation": entry(true, "1.0.0") }),
        ))
        .await;

    agent.expect("d9", DeliveryResult::Acked).await;
    let failed = agent.expect("d9", DeliveryResult::Failed).await;
    assert!(failed.error.unwrap().contains("sequence"));
}

#[tokio::test]
async fn a_flag_for_a_newer_client_is_stored_without_a_restart_and_turns_on_after_the_update() {
    let Some((mut agent, gate)) = Agent::start_as("1.5.9").await else {
        return;
    };

    agent
        .send(command(
            "d20",
            Some(20),
            json!({ "delivery-tool-installation": entry(true, "1.6.0") }),
        ))
        .await;

    agent.expect("d20", DeliveryResult::Acked).await;
    agent.expect("d20", DeliveryResult::Done).await;
    expect_no_restart(&gate).await;
    assert!(agent
        .persisted()
        .flags
        .contains_key("delivery-tool-installation"));

    let (_updated, service) = agent.launch_as("1.6.0").await;

    assert!(service
        .flags()
        .is_enabled(Feature::DeliveryToolInstallation));
    agent.expect_silence("d20").await;
}

#[tokio::test]
async fn a_rollback_below_the_min_version_runs_with_the_flag_off() {
    let Some((mut agent, gate)) = Agent::start().await else {
        return;
    };
    agent
        .send(command(
            "d21",
            Some(21),
            json!({ "delivery-tool-installation": entry(true, "1.5.0") }),
        ))
        .await;
    timeout(BOUND, gate.requested())
        .await
        .expect("restart was never requested");

    let (_rolled_back, service) = agent.launch_as("1.4.0").await;

    assert!(!service
        .flags()
        .is_enabled(Feature::DeliveryToolInstallation));
}

#[tokio::test]
async fn a_dev_build_applies_a_true_flag_whatever_its_min_version() {
    let Some((mut agent, gate)) = Agent::start_as(DEV_CLIENT_VERSION).await else {
        return;
    };

    agent
        .send(command(
            "d22",
            Some(22),
            json!({ "delivery-tool-installation": entry(true, "99.0.0") }),
        ))
        .await;

    agent.expect("d22", DeliveryResult::Acked).await;
    timeout(BOUND, gate.requested())
        .await
        .expect("restart was never requested");
}

#[tokio::test]
async fn invalid_flag_entries_are_done_without_a_restart() {
    let Some((mut agent, gate)) = Agent::start().await else {
        return;
    };

    agent
        .send(command(
            "d23",
            Some(23),
            json!({
                "delivery-tool-installation": true,
                "delivery-client-uninstall": { "enabled": true },
                "delivery-client-update": { "enabled": true, "minVersion": "latest" }
            }),
        ))
        .await;

    agent.expect("d23", DeliveryResult::Acked).await;
    agent.expect("d23", DeliveryResult::Done).await;
    expect_no_restart(&gate).await;
    assert!(agent.persisted().flags.is_empty());
}

#[derive(Clone, Default)]
struct FakeHandler {
    busy: Arc<AtomicBool>,
    floor: Arc<AtomicI64>,
    runs: Arc<Mutex<Vec<String>>>,
    release: Arc<Notify>,
}

#[derive(serde::Deserialize)]
struct FakeCommand {
    action: String,
}

impl FakeHandler {
    fn runs(&self) -> Vec<String> {
        self.runs.lock().unwrap().clone()
    }
}

impl CommandHandler for FakeHandler {
    type Command = FakeCommand;
    type Guard = ();

    const KIND: &'static str = "fake";
    const SEQUENCED: bool = true;

    fn subject(machine_id: &str) -> String {
        format!("machine.{machine_id}.fake.v2")
    }

    fn begin(&self, _command: &FakeCommand) -> Begin<()> {
        if self.busy.load(Ordering::Acquire) {
            return Begin::Busy("busy".to_string());
        }
        Begin::Accepted(())
    }

    fn applied_sequence(&self, _machine_id: &str) -> i64 {
        self.floor.load(Ordering::Acquire)
    }

    async fn run(
        &self,
        _machine_id: &str,
        delivery: &DeliveryRef,
        command: FakeCommand,
        _guard: (),
    ) -> Outcome {
        self.runs.lock().unwrap().push(delivery.dispatch_id.clone());
        match command.action.as_str() {
            "fail" => Outcome::Failed("boom".to_string()),
            "hold" => {
                self.release.notified().await;
                Outcome::Done
            }
            _ => Outcome::Done,
        }
    }
}

fn fake(dispatch_id: &str, sequence: Option<i64>, action: &str) -> serde_json::Value {
    let mut delivery = json!({
        "type": "FAKE",
        "targetId": "target",
        "dispatchId": dispatch_id,
    });
    if let Some(sequence) = sequence {
        delivery["sequence"] = json!(sequence);
    }
    json!({ "delivery": delivery, "action": action })
}

#[tokio::test]
async fn a_busy_command_gets_no_ack_and_runs_on_the_backend_retry() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let handler = agent.launch_fake().await;
    handler.busy.store(true, Ordering::Release);

    agent.send_fake(fake("f1", Some(1), "done")).await;
    agent.expect_silence("f1").await;

    handler.busy.store(false, Ordering::Release);
    agent.send_fake(fake("f1", Some(1), "done")).await;
    agent.expect("f1", DeliveryResult::Acked).await;
    agent.expect("f1", DeliveryResult::Done).await;
    assert_eq!(handler.runs(), vec!["f1"]);
}

#[tokio::test]
async fn a_repeated_dispatch_re_sends_the_result_without_running_again() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let handler = agent.launch_fake().await;
    agent.send_fake(fake("f2", Some(2), "fail")).await;
    agent.expect("f2", DeliveryResult::Acked).await;
    agent.expect("f2", DeliveryResult::Failed).await;
    agent.until_flushed().await;

    agent.send_fake(fake("f2", Some(2), "fail")).await;

    let repeated = agent.expect("f2", DeliveryResult::Failed).await;
    assert_eq!(repeated.error.as_deref(), Some("boom"));
    assert_eq!(handler.runs(), vec!["f2"]);
}

#[tokio::test]
async fn a_repeat_queued_behind_its_own_run_gets_the_result_without_running_again() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let handler = agent.launch_fake().await;
    agent.send_fake(fake("f3", Some(3), "hold")).await;
    agent.expect("f3", DeliveryResult::Acked).await;

    agent.send_fake(fake("f3", Some(3), "hold")).await;
    handler.release.notify_one();

    agent.expect("f3", DeliveryResult::Done).await;
    while let Ok(repeat) = timeout(QUIET, agent.next_result("f3")).await {
        assert_eq!(repeat.result, DeliveryResult::Done);
    }
    assert_eq!(handler.runs(), vec!["f3"]);
}

#[tokio::test]
async fn a_stale_sequence_is_acked_and_done_without_running() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let handler = agent.launch_fake().await;
    agent.send_fake(fake("f4", Some(4), "done")).await;
    agent.expect("f4", DeliveryResult::Acked).await;
    agent.expect("f4", DeliveryResult::Done).await;

    for (dispatch_id, sequence) in [("f5", 4), ("f6", 3)] {
        agent
            .send_fake(fake(dispatch_id, Some(sequence), "fail"))
            .await;

        agent.expect(dispatch_id, DeliveryResult::Acked).await;
        agent.expect(dispatch_id, DeliveryResult::Done).await;
    }
    assert_eq!(handler.runs(), vec!["f4"]);
}

#[tokio::test]
async fn a_failed_run_does_not_move_the_applied_sequence() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let handler = agent.launch_fake().await;
    agent.send_fake(fake("f7", Some(7), "fail")).await;
    agent.expect("f7", DeliveryResult::Acked).await;
    agent.expect("f7", DeliveryResult::Failed).await;

    agent.send_fake(fake("f8", Some(7), "done")).await;

    agent.expect("f8", DeliveryResult::Acked).await;
    agent.expect("f8", DeliveryResult::Done).await;
    assert_eq!(handler.runs(), vec!["f7", "f8"]);
}

#[tokio::test]
async fn a_sequence_at_or_below_the_handler_floor_is_done_without_running() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let handler = agent.launch_fake().await;
    handler.floor.store(10, Ordering::Release);

    agent.send_fake(fake("f9", Some(10), "done")).await;
    agent.expect("f9", DeliveryResult::Acked).await;
    agent.expect("f9", DeliveryResult::Done).await;
    agent.send_fake(fake("f10", Some(11), "done")).await;
    agent.expect("f10", DeliveryResult::Acked).await;
    agent.expect("f10", DeliveryResult::Done).await;

    assert_eq!(handler.runs(), vec!["f10"]);
}

#[derive(Clone, Default)]
struct LeavingHandler {
    events: Arc<Mutex<Vec<String>>>,
}

impl LeavingHandler {
    fn events_of(&self, dispatch_id: &str) -> Vec<String> {
        self.events
            .lock()
            .unwrap()
            .iter()
            .filter(|event| event.ends_with(&format!(":{dispatch_id}")))
            .cloned()
            .collect()
    }
}

impl CommandHandler for LeavingHandler {
    type Command = FakeCommand;
    type Guard = ();

    const KIND: &'static str = "leaving";
    const REMOVES_AGENT: bool = true;

    fn subject(machine_id: &str) -> String {
        format!("machine.{machine_id}.leaving.v2")
    }

    fn begin(&self, _command: &FakeCommand) -> Begin<()> {
        Begin::Accepted(())
    }

    async fn run(
        &self,
        _machine_id: &str,
        delivery: &DeliveryRef,
        command: FakeCommand,
        _guard: (),
    ) -> Outcome {
        self.events
            .lock()
            .unwrap()
            .push(format!("run:{}", delivery.dispatch_id));
        match command.action.as_str() {
            "fail" => Outcome::Failed("unsupported".to_string()),
            _ => Outcome::Done,
        }
    }

    async fn remove_agent(&self) {
        let mut events = self.events.lock().unwrap();
        let last = events.last().cloned().unwrap_or_default();
        events.push(last.replacen("run:", "removed:", 1));
    }
}

#[tokio::test]
async fn the_agent_is_removed_only_after_done_is_published() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let handler = agent.launch_command(LeavingHandler::default()).await;
    let subject = LeavingHandler::subject(MACHINE);

    agent
        .send_to(subject.clone(), fake("u1", None, "done"))
        .await;
    agent.expect("u1", DeliveryResult::Acked).await;
    agent.expect("u1", DeliveryResult::Done).await;
    timeout(BOUND, async {
        while handler.events_of("u1") != ["run:u1", "removed:u1"] {
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("the agent was never removed");

    agent.send_to(subject, fake("u2", None, "fail")).await;
    agent.expect("u2", DeliveryResult::Acked).await;
    agent.expect("u2", DeliveryResult::Failed).await;
    agent.expect_silence("u2").await;
    assert_eq!(handler.events_of("u2"), ["run:u2"]);
}

#[tokio::test]
async fn a_command_cut_short_by_the_last_stop_is_failed_before_a_listener_subscribes() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let subject = format!("machine.{MACHINE}.delivery.result");
    let cut = DeliveryRef {
        delivery_type: "FAKE".to_string(),
        target_id: "target".to_string(),
        dispatch_id: "cut".to_string(),
        sequence: None,
    };
    agent
        .store
        .delivery_accept(subject, cut, LedgerState::InFlight)
        .await
        .unwrap();

    let handler = agent.launch_fake().await;

    let failed = agent.expect("cut", DeliveryResult::Failed).await;
    assert_eq!(
        failed.error.as_deref(),
        Some("interrupted by agent restart")
    );
    assert_eq!(
        agent.store.delivery_state("cut".to_string()).await.unwrap(),
        Some(LedgerState::Settled(failed))
    );
    assert!(handler.runs().is_empty());
}

fn client_update(dispatch_id: &str, version: &str) -> serde_json::Value {
    json!({
        "delivery": {
            "type": "CLIENT_UPDATE",
            "targetId": "openframe-client",
            "dispatchId": dispatch_id,
            "sequence": 1,
        },
        "version": version,
        "downloadConfigurations": [],
    })
}

#[tokio::test]
async fn a_failed_client_update_is_reported_and_stops_holding_tool_operations() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let handler = ClientUpdateHandler::new(
        agent.client_update_service(),
        agent.tool_run_manager.clone(),
    );
    agent.launch_command(handler).await;

    agent
        .send_to(
            ClientUpdateHandler::subject(MACHINE),
            client_update("u1", "latest"),
        )
        .await;

    agent.expect("u1", DeliveryResult::Acked).await;
    let failed = agent.expect("u1", DeliveryResult::Failed).await;
    assert!(
        failed.error.as_deref().unwrap().contains("Invalid version"),
        "{failed:?}"
    );
    assert!(!agent.tool_run_manager.is_client_update_pending());
}

#[tokio::test]
async fn a_client_update_waits_for_a_busy_tool_or_a_running_update_without_an_ack() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let service = agent.client_update_service();
    agent
        .launch_command(ClientUpdateHandler::new(
            service.clone(),
            agent.tool_run_manager.clone(),
        ))
        .await;

    let busy = agent
        .tool_ops
        .try_lock("mesh")
        .expect("free tool")
        .mark_busy();
    agent
        .send_to(
            ClientUpdateHandler::subject(MACHINE),
            client_update("u1", "9.9.9"),
        )
        .await;
    agent.expect_silence("u1").await;
    assert!(agent.tool_run_manager.is_client_update_pending());
    drop(busy);

    let running: OpenFrameClientUpdateMessage =
        serde_json::from_value(client_update("running", "9.9.8")).unwrap();
    let _running = service.reserve(&running).unwrap();
    // as after an early updater exit, which clears pending while its watcher still holds the slot
    agent.tool_run_manager.clear_client_update_pending();
    agent
        .send_to(
            ClientUpdateHandler::subject(MACHINE),
            client_update("u2", "9.9.9"),
        )
        .await;
    agent.expect_silence("u2").await;
    assert!(!agent.tool_run_manager.is_client_update_pending());
}

/// A package-update listener on the agent, with the backend's status stream subscribed first.
async fn launch_package_update(agent: &mut Agent) -> (Arc<OrderStore>, async_nats::Subscriber) {
    async_nats::jetstream::new(agent.tester.clone())
        .create_stream(async_nats::jetstream::stream::Config {
            name: "PACKAGE_UPDATE_STATUS".into(),
            subjects: vec!["machine.*.package-update.status".into()],
            ..Default::default()
        })
        .await
        .unwrap();
    let statuses = agent
        .tester
        .subscribe(format!("machine.{MACHINE}.package-update.status"))
        .await
        .unwrap();
    agent.tester.flush().await.unwrap();
    let orders = Arc::new(OrderStore::load(
        agent.directories.secured_dir().join("package_updates.json"),
    ));
    let status = StatusReporter::new(
        agent.publisher.clone(),
        agent.store.clone(),
        agent.flush.clone(),
    );
    let results = DeliveryResults::new(
        agent.publisher.clone(),
        agent.store.clone(),
        agent.flush.clone(),
    );
    agent
        .launch_command(PackageUpdateHandler::new(orders.clone(), status, results))
        .await;
    (orders, statuses)
}

fn package_order(
    dispatch_id: &str,
    request_id: &str,
    package: serde_json::Value,
) -> serde_json::Value {
    json!({
        "delivery": {
            "type": "PACKAGE_UPDATE",
            "targetId": "target",
            "dispatchId": dispatch_id,
            "sequence": 1,
        },
        "requestId": request_id,
        "source": {"kind": "MANUAL", "origin": "ADMIN"},
        "package": package,
        "mode": "WAIT",
    })
}

#[tokio::test]
async fn a_package_update_order_is_acked_stored_and_answered_only_when_it_ends() {
    let package = if cfg!(windows) {
        json!({"manager": "WINGET", "id": "Vendor.App"})
    } else {
        json!({"manager": "BREW", "kind": "CASK", "name": "vendor-app"})
    };
    let parsed: PackageRef = serde_json::from_value(package.clone()).unwrap();
    if !is_supported(ManagerId::of(&parsed)) {
        return;
    }
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let (orders, _statuses) = launch_package_update(&mut agent).await;
    let subject = format!("machine.{MACHINE}.package-update");

    agent
        .send_to(
            subject.clone(),
            package_order("p1", "req-1", package.clone()),
        )
        .await;

    let acked = agent.expect("p1", DeliveryResult::Acked).await;
    agent.expect_silence("p1").await;
    assert_eq!(
        agent.store.delivery_state("p1".to_string()).await.unwrap(),
        Some(LedgerState::Deferred)
    );
    let stored = OrderStore::load(agent.directories.secured_dir().join("package_updates.json"));
    let order = stored.get("req-1").unwrap();
    assert_eq!(order.package, parsed);
    assert_eq!(order.deliveries, vec![acked.delivery]);

    agent
        .send_to(subject, package_order("p1", "req-1", package))
        .await;
    agent.expect("p1", DeliveryResult::Acked).await;
    agent.expect_silence("p1").await;
    assert_eq!(orders.get("req-1").unwrap().deliveries.len(), 1);

    let handler = agent.launch_fake().await;
    agent.send_fake(fake("other", Some(1), "done")).await;
    agent.expect("other", DeliveryResult::Acked).await;
    agent.expect("other", DeliveryResult::Done).await;
    assert_eq!(handler.runs(), ["other"]);
    agent.expect_silence("p1").await;
    assert_eq!(
        agent.store.delivery_state("p1".to_string()).await.unwrap(),
        Some(LedgerState::Deferred),
        "the next listener's restart recovery leaves it waiting"
    );
}

#[tokio::test]
async fn an_unsupported_package_update_is_refused_on_the_status_stream() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let (orders, mut statuses) = launch_package_update(&mut agent).await;

    agent
        .send_to(
            format!("machine.{MACHINE}.package-update"),
            package_order("p2", "req-2", json!({"manager": "CHOCO", "id": "git"})),
        )
        .await;

    agent.expect("p2", DeliveryResult::Acked).await;
    agent.expect("p2", DeliveryResult::Done).await;
    let message = timeout(BOUND, statuses.next())
        .await
        .expect("no event on the status stream")
        .expect("status subscription ended");
    let event: PackageUpdateStatusMessage = serde_json::from_slice(&message.payload).unwrap();
    assert_eq!(event.request_id, "req-2");
    assert_eq!(event.machine_id, MACHINE);
    assert_eq!(event.state, UpdateStatus::Failed);
    assert_eq!(
        event.failed.map(|failed| failed.reason),
        Some(FailReason::NotSupported)
    );
    assert!(orders.get("req-2").is_none());
}

#[tokio::test]
async fn a_waiting_package_order_holds_neither_a_restart_nor_the_next_order() {
    let package = if cfg!(windows) {
        json!({"manager": "WINGET", "id": "Vendor.App"})
    } else {
        json!({"manager": "BREW", "kind": "CASK", "name": "vendor-app"})
    };
    let parsed: PackageRef = serde_json::from_value(package.clone()).unwrap();
    if !is_supported(ManagerId::of(&parsed)) {
        return;
    }
    let Some((mut agent, _flags_gate)) = Agent::start().await else {
        return;
    };
    let orders = Arc::new(OrderStore::load(
        agent.directories.secured_dir().join("package_updates.json"),
    ));
    let status = StatusReporter::new(
        agent.publisher.clone(),
        agent.store.clone(),
        agent.flush.clone(),
    );
    let results = DeliveryResults::new(
        agent.publisher.clone(),
        agent.store.clone(),
        agent.flush.clone(),
    );
    let (_, gate) = agent
        .launch_command_gated(PackageUpdateHandler::new(orders.clone(), status, results))
        .await;
    let subject = format!("machine.{MACHINE}.package-update");

    for (i, name) in ["one", "two", "three"].iter().enumerate() {
        let mut other = package.clone();
        if cfg!(windows) {
            other["id"] = json!(format!("Vendor.{name}"));
        } else {
            other["name"] = json!(format!("vendor-{name}"));
        }
        let dispatch = format!("p-{name}");
        agent
            .send_to(
                subject.clone(),
                package_order(&dispatch, &format!("req-{i}"), other),
            )
            .await;
        agent.expect(&dispatch, DeliveryResult::Acked).await;
    }
    assert_eq!(orders.pending(MACHINE).len(), 3);

    timeout(Duration::from_secs(5), gate.drain_and_request())
        .await
        .expect("a waiting package order held the restart");
    for name in ["one", "two", "three"] {
        agent.expect_silence(&format!("p-{name}")).await;
        assert_eq!(
            agent
                .store
                .delivery_state(format!("p-{name}"))
                .await
                .unwrap(),
            Some(LedgerState::Deferred)
        );
    }
}

/// A package-adopt listener with its worker running, and the backend's status stream subscribed first.
async fn launch_package_adopt(agent: &mut Agent) -> async_nats::Subscriber {
    async_nats::jetstream::new(agent.tester.clone())
        .create_stream(async_nats::jetstream::stream::Config {
            name: "PACKAGE_ADOPT_STATUS".into(),
            subjects: vec!["machine.*.package-adopt.status".into()],
            ..Default::default()
        })
        .await
        .unwrap();
    let statuses = agent
        .tester
        .subscribe(format!("machine.{MACHINE}.package-adopt.status"))
        .await
        .unwrap();
    agent.tester.flush().await.unwrap();
    let runner = Arc::new(PackageAdoptRunner::new(
        agent.publisher.clone(),
        agent.store.clone(),
        agent.flush.clone(),
        RestartSignals {
            client_update: agent.tool_run_manager.client_update_pending(),
            agent_restart: Latch::default().view(),
        },
        InProgress::default(),
        BrewLock::default(),
    ));
    runner.start();
    agent.launch_command(PackageAdoptHandler::new(runner)).await;
    statuses
}

fn adopt_order(dispatch_id: &str, request_id: &str) -> serde_json::Value {
    json!({
        "delivery": {
            "type": "PACKAGE_ADOPT",
            "targetId": request_id,
            "dispatchId": dispatch_id,
            "sequence": 1,
        },
        "requestId": request_id,
        "package": {"manager": "BREW", "kind": "FORMULA", "name": "wget"},
        "bundleId": "org.gnu.wget",
    })
}

#[tokio::test]
async fn an_adopt_order_is_acked_then_answered_with_its_status_only() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let mut statuses = launch_package_adopt(&mut agent).await;
    let subject = format!("machine.{MACHINE}.package-adopt");

    agent
        .send_to(subject.clone(), adopt_order("a1", "req-1"))
        .await;

    agent.expect("a1", DeliveryResult::Acked).await;
    let message = timeout(BOUND, statuses.next())
        .await
        .expect("no event on the adopt status stream")
        .expect("status subscription ended");
    let status: serde_json::Value = serde_json::from_slice(&message.payload).unwrap();
    assert_eq!(status["requestId"], "req-1");
    assert_eq!(status["machineId"], MACHINE);
    assert_eq!(status["state"], "FAILED");
    assert_eq!(status["reason"], "NOT_SUPPORTED");
    agent.until_flushed().await;
    agent.expect_silence("a1").await;
    assert!(
        matches!(
            agent.store.delivery_state("a1".to_string()).await.unwrap(),
            Some(LedgerState::Settled(ref kept)) if kept.result == DeliveryResult::Done
        ),
        "the handled order is kept for repeats"
    );

    agent.send_to(subject, adopt_order("a1", "req-1")).await;
    agent.expect("a1", DeliveryResult::Done).await;
    let again = timeout(QUIET, statuses.next()).await;
    assert!(again.is_err(), "a repeated dispatch ran again: {again:?}");
}

#[tokio::test]
async fn an_adopt_order_lost_to_the_last_stop_is_failed_before_the_listener_subscribes() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let lost = DeliveryRef {
        delivery_type: "PACKAGE_ADOPT".to_string(),
        target_id: "req-9".to_string(),
        dispatch_id: "lost".to_string(),
        sequence: Some(1),
    };
    agent
        .store
        .delivery_accept(
            format!("machine.{MACHINE}.delivery.result"),
            lost,
            LedgerState::Deferred,
        )
        .await
        .unwrap();

    let _statuses = launch_package_adopt(&mut agent).await;

    let failed = agent.expect("lost", DeliveryResult::Failed).await;
    assert_eq!(
        failed.error.as_deref(),
        Some("the agent lost the work it took on")
    );
}

fn installed_tool(
    tool_agent_id: &str,
    version: &str,
    state: ToolRecordState,
    assets: Vec<InstalledAsset>,
) -> InstalledTool {
    InstalledTool {
        tool_agent_id: tool_agent_id.into(),
        version: version.into(),
        assets,
        state,
        ..Default::default()
    }
}

fn tool_update(
    dispatch_id: &str,
    sequence: i64,
    tool_agent_id: &str,
    version: &str,
) -> serde_json::Value {
    json!({
        "delivery": {
            "type": "TOOL_UPDATE",
            "targetId": tool_agent_id,
            "dispatchId": dispatch_id,
            "sequence": sequence,
        },
        "toolAgentId": tool_agent_id,
        "version": version,
        "downloadConfigurations": [],
        "assets": null,
    })
}

async fn next_report(reports: &mut async_nats::Subscriber) -> (String, String) {
    let message = timeout(BOUND, reports.next())
        .await
        .expect("no installed-agent report")
        .expect("installed-agent subscription ended");
    let report: InstalledAgentMessage = serde_json::from_slice(&message.payload).unwrap();
    (report.agent_type, report.version)
}

#[tokio::test]
async fn every_installed_tool_and_asset_version_is_published() {
    let Some((agent, _gate)) = Agent::start().await else {
        return;
    };
    agent
        .install_tool(installed_tool(
            "fleetmdm-agent",
            "0.4.18",
            ToolRecordState::Installed,
            vec![InstalledAsset {
                id: "osqueryd".into(),
                version: "0.0.11".into(),
                executable: true,
            }],
        ))
        .await;
    agent
        .install_tool(installed_tool(
            "meshcentral-agent",
            "0.0.32",
            ToolRecordState::Installing,
            Vec::new(),
        ))
        .await;
    let mut reports = agent.installed_agents().await;

    agent
        .tool_update_service()
        .publish_installed_versions()
        .await;

    let mut heard = vec![
        next_report(&mut reports).await,
        next_report(&mut reports).await,
    ];
    heard.sort();
    assert_eq!(
        heard,
        [
            ("fleetmdm-agent".to_string(), "0.4.18".to_string()),
            ("osqueryd".to_string(), "0.0.11".to_string()),
        ]
    );
    let more = timeout(QUIET, reports.next()).await;
    assert!(
        more.is_err(),
        "a tool still being installed was reported: {more:?}"
    );
}

#[tokio::test]
async fn an_update_to_the_installed_version_reports_it_again() {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    agent
        .install_tool(installed_tool(
            "openframe-chat",
            "1.6.10",
            ToolRecordState::Installed,
            Vec::new(),
        ))
        .await;
    let mut reports = agent.installed_agents().await;
    let handler = ToolUpdateHandler::new(
        agent.tool_update_service(),
        ToolOps::default(),
        agent.tool_run_manager.client_update_pending(),
    );
    agent.launch_command(handler).await;

    agent
        .send_to(
            ToolUpdateHandler::subject(MACHINE),
            tool_update("t1", 1, "openframe-chat", "1.6.10"),
        )
        .await;

    agent.expect("t1", DeliveryResult::Acked).await;
    agent.expect("t1", DeliveryResult::Done).await;
    assert_eq!(
        next_report(&mut reports).await,
        ("openframe-chat".to_string(), "1.6.10".to_string())
    );
}

#[cfg(target_os = "windows")]
#[tokio::test]
async fn an_update_whose_old_binary_is_still_running_fails_and_keeps_the_recorded_version() {
    use std::io::Write;
    use std::os::windows::fs::OpenOptionsExt;

    const TOOL: &str = "it-locked-tool";
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    agent
        .install_tool(installed_tool(
            TOOL,
            "0.4.16",
            ToolRecordState::Installed,
            Vec::new(),
        ))
        .await;
    let binary = agent.directories.get_tool_executable_path(TOOL, None);
    let aside = crate::platform::binary_writer::aside_path(&binary);
    std::fs::write(&aside, b"agent").unwrap();
    let _running = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(&aside)
        .unwrap();

    let new_agent = vec![7u8; 200 * 1024];
    let mut archive = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    archive
        .start_file(
            "agent.exe",
            zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored),
        )
        .unwrap();
    archive.write_all(&new_agent).unwrap();
    let release =
        crate::test_support::mock_server_with_body(&[200], archive.finish().unwrap().into_inner())
            .await;

    let handler = ToolUpdateHandler::new(
        agent.tool_update_service(),
        ToolOps::default(),
        agent.tool_run_manager.client_update_pending(),
    );
    agent.launch_command(handler).await;
    let mut update = tool_update("t1", 1, TOOL, "0.4.18");
    update["downloadConfigurations"] = json!([{
        "os": "windows",
        "fileName": "agent.zip",
        "agentFileName": "agent.exe",
        "link": format!("{}/agent.zip", release.url),
        "installationType": "STANDARD",
    }]);
    agent
        .send_to(ToolUpdateHandler::subject(MACHINE), update)
        .await;

    agent.expect("t1", DeliveryResult::Acked).await;
    let failed = agent.expect("t1", DeliveryResult::Failed).await;
    assert!(
        failed.error.as_deref().unwrap().contains("still holds"),
        "{failed:?}"
    );
    assert_eq!(std::fs::read(&binary).unwrap(), new_agent);
    let recorded = InstalledToolsService::new(agent.directories.clone())
        .unwrap()
        .get_by_tool_agent_id(TOOL)
        .await
        .unwrap()
        .expect("record kept");
    assert_eq!(recorded.version, "0.4.16");
}

async fn an_install_of_a_present_tool_rewrites_its_command_asset(asset_left_empty: bool) {
    use std::io::Write;

    const TOOL: &str = "it-asset-tool";
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let run_args = vec![
        "--helper".to_string(),
        "${client.assetPath.helper}".to_string(),
    ];
    agent
        .install_tool(InstalledTool {
            run_command_args: run_args.clone(),
            ..installed_tool(TOOL, "1.0.0", ToolRecordState::Installed, Vec::new())
        })
        .await;
    let asset = agent.directories.get_asset_path(TOOL, "helper", true);
    if asset_left_empty {
        std::fs::write(&asset, b"").unwrap();
    }

    let helper = vec![9u8; 150 * 1024];
    let stored =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    let mut archive = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    for (name, bytes) in [("agent", vec![7u8; 150 * 1024]), ("helper", helper.clone())] {
        archive.start_file(name, stored).unwrap();
        archive.write_all(&bytes).unwrap();
    }
    let release =
        crate::test_support::mock_server_with_body(&[200], archive.finish().unwrap().into_inner())
            .await;
    let link = format!("{}/release.zip", release.url);
    let tool_config = |os: &str| json!({"os": os, "fileName": "release.zip", "agentFileName": "agent", "link": link, "installationType": "STANDARD"});
    let asset_config = |os: &str| json!({"os": os, "fileName": "release.zip", "assetFileName": "helper", "link": link});

    let _reports = agent.installed_agents().await;
    let handler = ToolInstallationHandler::new(
        agent.tool_installation_service(),
        ToolOps::default(),
        agent.tool_run_manager.client_update_pending(),
    );
    agent.launch_command(handler).await;
    agent
        .send_to(
            ToolInstallationHandler::subject(MACHINE),
            json!({
                "delivery": {"type": "TOOL_INSTALLATION", "targetId": TOOL, "dispatchId": "i1", "sequence": 1},
                "toolAgentId": TOOL,
                "toolId": "it-asset-tool-server",
                "toolType": "",
                "version": "1.0.0",
                "reinstall": false,
                "downloadConfigurations": [tool_config("windows"), tool_config("macos")],
                "runCommandArgs": run_args,
                "assets": [{
                    "id": "helper",
                    "source": "GITHUB",
                    "executable": true,
                    "version": "1.0.0",
                    "localFilenameConfiguration": [{"os": "windows", "filename": "helper"}, {"os": "macos", "filename": "helper"}],
                    "downloadConfigurations": [asset_config("windows"), asset_config("macos")],
                }],
            }),
        )
        .await;

    agent.expect("i1", DeliveryResult::Acked).await;
    agent.expect("i1", DeliveryResult::Done).await;
    assert_eq!(std::fs::read(&asset).unwrap(), helper);
}

#[tokio::test]
async fn an_install_of_a_present_tool_downloads_its_missing_command_asset() {
    an_install_of_a_present_tool_rewrites_its_command_asset(false).await;
}

#[tokio::test]
async fn an_install_of_a_present_tool_rewrites_its_empty_command_asset() {
    an_install_of_a_present_tool_rewrites_its_command_asset(true).await;
}

const CURRENT_OS: &str = if cfg!(target_os = "windows") {
    "windows"
} else if cfg!(target_os = "macos") {
    "macos"
} else {
    "linux"
};

type ToolExit = tokio::sync::oneshot::Receiver<String>;

/// Starts a long-running process from `path`; the receiver gets how it exited.
fn run_tool_process(path: &std::path::Path) -> ToolExit {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let _ = std::fs::remove_file(path);
    #[cfg(windows)]
    let args = {
        std::fs::copy(r"C:\Windows\System32\PING.EXE", path).unwrap();
        ["-n", "300", "127.0.0.1"].as_slice()
    };
    // A script, not a copied system binary: macOS may SIGKILL a copied signed binary at any time.
    #[cfg(unix)]
    let args = {
        use std::os::unix::fs::PermissionsExt;
        std::fs::write(path, "#!/bin/sh\nwhile :; do sleep 1; done\n").unwrap();
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
        <&[&str]>::default()
    };
    let mut child = tokio::process::Command::new(path)
        .args(args)
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    let (exited, on_exit) = tokio::sync::oneshot::channel();
    tokio::spawn(async move {
        let _ = exited.send(format!("{:?}", child.wait().await));
    });
    on_exit
}

fn agent_file_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "agent.exe"
    } else {
        "agent"
    }
}

/// Bytes that do not compress, so the archive stays above the minimum download size.
fn agent_bytes() -> Vec<u8> {
    let mut state = 0x2545_f491_u32;
    (0..150 * 1024)
        .map(|_| {
            state ^= state << 13;
            state ^= state >> 17;
            state ^= state << 5;
            state as u8
        })
        .collect()
}

/// A release archive in the format this OS extracts, holding `entry`.
fn release_archive(entry: &str, bytes: &[u8]) -> (&'static str, Vec<u8>) {
    #[cfg(windows)]
    {
        use std::io::Write;
        let mut archive = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        archive
            .start_file(
                entry,
                zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Stored),
            )
            .unwrap();
        archive.write_all(bytes).unwrap();
        ("release.zip", archive.finish().unwrap().into_inner())
    }
    #[cfg(unix)]
    {
        let mut header = tar::Header::new_gnu();
        header.set_size(bytes.len() as u64);
        header.set_mode(0o755);
        header.set_cksum();
        let mut archive = tar::Builder::new(flate2::write::GzEncoder::new(
            Vec::new(),
            flate2::Compression::fast(),
        ));
        archive.append_data(&mut header, entry, bytes).unwrap();
        (
            "release.tar.gz",
            archive.into_inner().unwrap().finish().unwrap(),
        )
    }
}

impl Agent {
    async fn launch_tool_updates(&mut self) {
        let handler = ToolUpdateHandler::new(
            self.tool_update_service(),
            ToolOps::default(),
            self.tool_run_manager.client_update_pending(),
        );
        self.launch_command(handler).await;
    }

    async fn send_tool_update(
        &self,
        tool_agent_id: &str,
        download_configuration: serde_json::Value,
    ) {
        let mut update = tool_update("u1", 1, tool_agent_id, "2.0.0");
        update["downloadConfigurations"] = json!([download_configuration]);
        self.send_to(ToolUpdateHandler::subject(MACHINE), update)
            .await;
    }

    async fn recorded_version(&self, tool_agent_id: &str) -> String {
        InstalledToolsService::new(self.directories.clone())
            .unwrap()
            .get_by_tool_agent_id(tool_agent_id)
            .await
            .unwrap()
            .expect("record kept")
            .version
    }
}

async fn a_failed_download_leaves_the_running_tool_untouched(
    tool_agent_id: &str,
    installation: Installation,
    target_file_name: &str,
    release: crate::test_support::MockServer,
    file_name: &str,
) {
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    let executable = agent
        .directories
        .get_tool_executable_path(tool_agent_id, installation.executable_path());
    let installation_type = match installation {
        Installation::Service { .. } => "SERVICE",
        _ => "STANDARD",
    };
    agent
        .install_tool(InstalledTool {
            installation,
            ..installed_tool(
                tool_agent_id,
                "1.0.0",
                ToolRecordState::Installed,
                Vec::new(),
            )
        })
        .await;
    let mut exited = run_tool_process(&executable);
    let running_image = std::fs::read(&executable).unwrap();
    agent.launch_tool_updates().await;

    agent
        .send_tool_update(
            tool_agent_id,
            json!({
                "os": CURRENT_OS,
                "fileName": file_name,
                "agentFileName": target_file_name,
                "link": format!("{}/{file_name}", release.url),
                "installationType": installation_type,
                "serviceName": "it-no-such-service",
            }),
        )
        .await;

    agent.expect("u1", DeliveryResult::Acked).await;
    let failed = agent.expect("u1", DeliveryResult::Failed).await;
    assert!(
        failed
            .error
            .as_deref()
            .unwrap()
            .contains("the running tool was not touched"),
        "{failed:?}"
    );
    let exit = exited.try_recv();
    assert_eq!(
        exit,
        Err(tokio::sync::oneshot::error::TryRecvError::Empty),
        "the running tool exited: {exit:?}"
    );
    assert_eq!(std::fs::read(&executable).unwrap(), running_image);
    assert!(!executable.with_extension("backup").exists());
    let leftovers: Vec<_> = std::fs::read_dir(agent.directories.get_tool_folder(tool_agent_id))
        .unwrap()
        .map(|entry| entry.unwrap().file_name())
        .filter(|name| name.to_string_lossy().ends_with(".update-staging"))
        .collect();
    assert!(leftovers.is_empty(), "staging left behind: {leftovers:?}");
    assert_eq!(agent.recorded_version(tool_agent_id).await, "1.0.0");
}

#[tokio::test]
async fn an_unreachable_download_leaves_the_running_standard_tool_untouched() {
    let (file_name, _) = release_archive(agent_file_name(), b"");
    a_failed_download_leaves_the_running_tool_untouched(
        "it-unreachable-standard",
        Installation::Standard {
            executable_path: None,
        },
        agent_file_name(),
        crate::test_support::mock_server(&[404]).await,
        file_name,
    )
    .await;
}

#[tokio::test]
async fn a_release_without_the_agent_leaves_the_running_standard_tool_untouched() {
    let (file_name, archive) = release_archive("not-the-agent", &agent_bytes());
    a_failed_download_leaves_the_running_tool_untouched(
        "it-agentless-release",
        Installation::Standard {
            executable_path: None,
        },
        agent_file_name(),
        crate::test_support::mock_server_with_body(&[200], archive).await,
        file_name,
    )
    .await;
}

#[tokio::test]
async fn an_unreachable_download_leaves_the_running_service_tool_untouched() {
    let (file_name, _) = release_archive(agent_file_name(), b"");
    a_failed_download_leaves_the_running_tool_untouched(
        "it-unreachable-service",
        Installation::Service {
            service_name: "it-no-such-service".into(),
            executable_path: None,
        },
        agent_file_name(),
        crate::test_support::mock_server(&[404]).await,
        file_name,
    )
    .await;
}

#[cfg(target_os = "macos")]
#[tokio::test]
async fn a_broken_app_bundle_release_leaves_the_running_bundle_and_no_staging() {
    const BUNDLE_EXECUTABLE: &str = "Test.app/Contents/MacOS/test";
    a_failed_download_leaves_the_running_tool_untouched(
        "it-broken-bundle",
        Installation::Service {
            service_name: "it-no-such-service".into(),
            executable_path: Some(BUNDLE_EXECUTABLE.into()),
        },
        BUNDLE_EXECUTABLE,
        crate::test_support::mock_server_with_body(&[200], agent_bytes()).await,
        "release.tar.gz",
    )
    .await;
}

#[tokio::test]
async fn an_update_stops_the_running_tool_and_replaces_its_binary() {
    const TOOL: &str = "it-replaced-tool";
    let Some((mut agent, _gate)) = Agent::start().await else {
        return;
    };
    agent
        .install_tool(installed_tool(
            TOOL,
            "1.0.0",
            ToolRecordState::Installed,
            Vec::new(),
        ))
        .await;
    let executable = agent.directories.get_tool_executable_path(TOOL, None);
    let exited = run_tool_process(&executable);
    let new_agent = agent_bytes();
    let (file_name, archive) = release_archive(agent_file_name(), &new_agent);
    let release = crate::test_support::mock_server_with_body(&[200], archive).await;
    let _reports = agent.installed_agents().await;
    agent.launch_tool_updates().await;

    agent
        .send_tool_update(
            TOOL,
            json!({
                "os": CURRENT_OS,
                "fileName": file_name,
                "agentFileName": agent_file_name(),
                "link": format!("{}/{file_name}", release.url),
                "installationType": "STANDARD",
            }),
        )
        .await;

    agent.expect("u1", DeliveryResult::Acked).await;
    agent.expect("u1", DeliveryResult::Done).await;
    timeout(BOUND, exited)
        .await
        .expect("the running tool was never stopped")
        .unwrap();
    assert_eq!(std::fs::read(&executable).unwrap(), new_agent);
    assert!(!executable.with_extension("backup").exists());
    assert_eq!(agent.recorded_version(TOOL).await, "2.0.0");
    assert_eq!(release.requests().len(), 1);
}
