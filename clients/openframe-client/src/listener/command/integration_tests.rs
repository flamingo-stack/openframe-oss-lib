use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex};

use futures::StreamExt;
use serde_json::json;
use tempfile::TempDir;
use tokio::sync::Notify;
use tokio::time::{timeout, Duration};

use super::{
    Begin, CommandContext, CommandHandler, CommandListener, FeatureFlagsHandler, Outcome,
    RestartGate,
};
use crate::clients::AuthClient;
use crate::config::update_config::DEV_CLIENT_VERSION;
use crate::models::{
    DeliveryRef, DeliveryResult, DeliveryResultMessage, Feature, FeatureFlagsState,
};
use crate::platform::DirectoryManager;
use crate::services::encryption_service::EncryptionService;
use crate::services::execution_service::ExecutionService;
use crate::services::feature_flags_service::FeatureFlagsService;
use crate::services::local_tls_config_provider::LocalTlsConfigProvider;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_outbox_run_manager::ResultOutboxRunManager;
use crate::services::result_store::{LedgerState, ResultStore};
use crate::services::shared_token_service::SharedTokenService;
use crate::services::tool_run_manager::ToolRunManager;
use crate::services::{
    AgentAuthService, AgentConfigurationService, DeactivationService, InitialConfigurationService,
    InstalledToolsService, MachineIdService, ToolCommandParamsResolver, ToolKillService, ToolOps,
};
use crate::test_support::NatsServer;

const MACHINE: &str = "it-machine";
const BOUND: Duration = Duration::from_secs(10);
const QUIET: Duration = Duration::from_millis(500);
const PROBE: &str = "probe";
const VERSION: &str = "1.5.1";

struct Agent {
    _server: NatsServer,
    _dir: TempDir,
    tester: async_nats::Client,
    results: async_nats::Subscriber,
    unclaimed: Vec<DeliveryResultMessage>,
    manager: NatsConnectionManager,
    config: AgentConfigurationService,
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
        let deactivation = DeactivationService::new(&directories);
        let auth = AgentAuthService::new(
            AuthClient::new(
                "http://127.0.0.1:9".into(),
                reqwest::Client::new(),
                deactivation.clone(),
            ),
            config.clone(),
            SharedTokenService::new(directories.clone(), EncryptionService::new()),
        );
        let manager = NatsConnectionManager::new(
            server.url(),
            config.clone(),
            initial.clone(),
            auth,
            LocalTlsConfigProvider::new(initial),
            deactivation,
            MachineIdService::new(&directories),
        );
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
            _dir: dir,
            tester,
            results,
            unclaimed: Vec::new(),
            manager,
            config,
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
        );
        let context = CommandContext::new(
            self.manager.clone(),
            self.config.clone(),
            gate.clone(),
            self.publisher.clone(),
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
        let (_gate, context) = self.context();
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
        handler
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

    fn persisted(&self) -> FeatureFlagsState {
        serde_json::from_slice(&std::fs::read(&self.flags_path).unwrap()).unwrap()
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
