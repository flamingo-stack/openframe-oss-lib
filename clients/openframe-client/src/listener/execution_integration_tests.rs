use std::sync::Arc;

use futures::StreamExt;
use serde_json::{json, Value};
use tempfile::TempDir;
use tokio::sync::Notify;
use tokio::time::{timeout, Duration};

use super::ExecutionListener;
use crate::clients::AuthClient;
use crate::models::{
    BootstrapScriptMessage, CommandMessage, ExecutionMessage, ScriptMessage,
    ScriptScheduleExecutionMessage, SoftwareScriptMessage,
};
use crate::platform::DirectoryManager;
use crate::services::encryption_service::EncryptionService;
use crate::services::execution_service::ExecutionService;
use crate::services::local_tls_config_provider::LocalTlsConfigProvider;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_outbox_run_manager::ResultOutboxRunManager;
use crate::services::result_store::{entry_key, now_secs, JournalRecord, ResultStore};
use crate::services::shared_token_service::SharedTokenService;
use crate::services::{
    AgentAuthService, AgentConfigurationService, DeactivationService, InitialConfigurationService,
    MachineIdService,
};
use crate::test_support::NatsServer;

const MACHINE: &str = "it-exec";
const BOUND: Duration = Duration::from_secs(20);
const SCHEDULE: &str = "sch-1";

/// Keys of the result the backends before `failure_reason` read (`RmmResultMessage` + `ScriptResultMessage`).
const LEGACY_KEYS: [&str; 10] = [
    "execution_id",
    "machine_id",
    "stdout",
    "stderr",
    "exit_code",
    "execution_time_ms",
    "timed_out",
    "error",
    "script_id",
    "schedule_id",
];

const OK: &str = "#!/bin/sh\necho hi\n";
const EXITS_3: &str = "#!/bin/sh\necho boom >&2\nexit 3\n";
const EXITS_85: &str = "#!/bin/sh\necho boom >&2\nexit 85\n";
const EXITS_98: &str = "#!/bin/sh\necho boom >&2\nexit 98\n";
const SLEEPS: &str = "#!/bin/sh\nsleep 30\n";
const BAD_SHEBANG: &str = "#!/nonexistent/ofcmd-bad\necho hi\n";

#[derive(Clone, Copy)]
enum Kind {
    Command,
    Script,
    Bootstrap,
    Software,
}

const SINGLE_KINDS: [Kind; 4] = [Kind::Command, Kind::Script, Kind::Bootstrap, Kind::Software];

impl Kind {
    fn name(self) -> &'static str {
        match self {
            Kind::Command => CommandMessage::KIND,
            Kind::Script => ScriptMessage::KIND,
            Kind::Bootstrap => BootstrapScriptMessage::KIND,
            Kind::Software => SoftwareScriptMessage::KIND,
        }
    }

    fn request(self, execution_id: &str, code: &str, timeout_secs: u64) -> Value {
        match self {
            Kind::Command => json!({
                "executionId": execution_id,
                "code": code,
                "shell": "SHELL",
                "timeout": timeout_secs,
            }),
            _ => json!({
                "executionId": execution_id,
                "scriptId": format!("{execution_id}-script"),
                "code": code,
                "shell": "SHELL",
                "timeoutSeconds": timeout_secs,
            }),
        }
    }
}

struct Agent {
    _server: NatsServer,
    _dir: TempDir,
    manager: NatsConnectionManager,
    publisher: NatsMessagePublisher,
    config: AgentConfigurationService,
    tester: async_nats::Client,
    results: async_nats::Subscriber,
    acks: async_nats::Subscriber,
    seen: Vec<(String, Value)>,
    store: Arc<ResultStore>,
    flush: Arc<Notify>,
}

impl Agent {
    async fn start() -> Option<Self> {
        let mut agent = Self::boot().await?;
        agent.listen().await;
        Some(agent)
    }

    /// What `Client::start` brings up before the execution listeners: NATS, the store, the flusher.
    async fn boot() -> Option<Self> {
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
                name: "EXECUTION_ACK".into(),
                subjects: vec!["machine.*.execution.acknowledge".into()],
                ..Default::default()
            })
            .await
            .unwrap();
        let results = tester
            .subscribe(format!("machine.{MACHINE}.*.result"))
            .await
            .unwrap();
        let acks = tester
            .subscribe(format!("machine.{MACHINE}.execution.acknowledge"))
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

        Some(Self {
            _server: server,
            _dir: dir,
            manager,
            publisher,
            config,
            tester,
            results,
            acks,
            seen: Vec::new(),
            store,
            flush,
        })
    }

    async fn listen(&mut self) {
        let execution = ExecutionService::new();
        macro_rules! listen {
            ($message:ty) => {
                ExecutionListener::<$message>::new(
                    self.manager.clone(),
                    self.publisher.clone(),
                    execution.clone(),
                    self.config.clone(),
                    self.store.clone(),
                    self.flush.clone(),
                )
                .start()
                .await
                .unwrap()
            };
        }
        listen!(CommandMessage);
        listen!(ScriptMessage);
        listen!(BootstrapScriptMessage);
        listen!(SoftwareScriptMessage);
        listen!(ScriptScheduleExecutionMessage);

        for kind in SINGLE_KINDS {
            self.until_listening(kind.name(), |id| kind.request(id, OK, 30))
                .await;
        }
        self.until_listening(ScriptScheduleExecutionMessage::KIND, |id| {
            schedule(id, &[("probe", OK, 30)])
        })
        .await;
    }

    async fn until_listening(&mut self, kind: &str, request: impl Fn(&str) -> Value) {
        let prefix = format!("probe-{kind}-");
        timeout(BOUND, async {
            for attempt in 0.. {
                self.send(kind, request(&format!("{prefix}{attempt}")))
                    .await;
                let answered =
                    timeout(Duration::from_secs(1), async {
                        loop {
                            if self.seen.iter().any(|(_, r)| {
                                r["execution_id"].as_str().unwrap().starts_with(&prefix)
                            }) {
                                return;
                            }
                            self.read_one().await;
                        }
                    })
                    .await;
                if answered.is_ok() {
                    return;
                }
            }
        })
        .await
        .unwrap_or_else(|_| panic!("the {kind} listener never answered"));
    }

    async fn send(&self, kind: &str, request: Value) {
        self.tester
            .publish(
                format!("machine.{MACHINE}.{kind}"),
                serde_json::to_vec(&request).unwrap().into(),
            )
            .await
            .unwrap();
        self.tester.flush().await.unwrap();
    }

    async fn read_one(&mut self) {
        let message = self
            .results
            .next()
            .await
            .expect("result subscription closed");
        let result: Value = serde_json::from_slice(&message.payload).unwrap();
        self.seen.push((message.subject.to_string(), result));
    }

    async fn result(&mut self, execution_id: &str, script_id: Option<&str>) -> (String, Value) {
        let matches = |r: &Value| {
            r["execution_id"] == execution_id && script_id.is_none_or(|id| r["script_id"] == id)
        };
        timeout(BOUND, async {
            loop {
                if let Some(at) = self.seen.iter().position(|(_, r)| matches(r)) {
                    return self.seen.remove(at);
                }
                self.read_one().await;
            }
        })
        .await
        .unwrap_or_else(|_| panic!("no result for {execution_id} {script_id:?}"))
    }

    async fn ack(&mut self, execution_id: &str) -> Value {
        timeout(BOUND, async {
            loop {
                let message = self.acks.next().await.expect("ack subscription closed");
                let ack: Value = serde_json::from_slice(&message.payload).unwrap();
                if ack["executionId"] == execution_id {
                    return ack;
                }
            }
        })
        .await
        .unwrap_or_else(|_| panic!("no ack for {execution_id}"))
    }
}

fn schedule(execution_id: &str, scripts: &[(&str, &str, u64)]) -> Value {
    json!({
        "executionId": execution_id,
        "scheduleId": SCHEDULE,
        "scripts": scripts
            .iter()
            .map(|(script_id, code, timeout_secs)| json!({
                "scriptId": script_id,
                "code": code,
                "shell": "SHELL",
                "timeoutSeconds": timeout_secs,
            }))
            .collect::<Vec<_>>(),
    })
}

/// The status rule of the backends before `failure_reason` (`RmmResultDeserializer.isFailed`,
/// `CommandExecutionHandler.decideStatus`).
fn legacy_status(result: &Value) -> &'static str {
    let timed_out = result["timed_out"] == true;
    let non_zero = result["exit_code"].as_i64() != Some(0);
    let error = result["error"]
        .as_str()
        .is_some_and(|e| !e.trim().is_empty());
    if timed_out || non_zero || error {
        "FAILED"
    } else {
        "SUCCESS"
    }
}

fn assert_wire_shape(result: &Value, allow_reason: bool) {
    for key in [
        "execution_id",
        "machine_id",
        "stdout",
        "stderr",
        "exit_code",
        "execution_time_ms",
        "timed_out",
    ] {
        assert!(result.get(key).is_some(), "missing {key} in {result}");
    }
    for key in result.as_object().unwrap().keys() {
        let known =
            LEGACY_KEYS.contains(&key.as_str()) || (allow_reason && key == "failure_reason");
        assert!(known, "unexpected key {key} in {result}");
    }
    assert_eq!(result["machine_id"], MACHINE);
}

fn result_subject(kind: &str) -> String {
    format!("machine.{MACHINE}.{kind}.result")
}

#[tokio::test]
async fn a_clean_run_goes_out_exactly_as_before_on_every_kind() {
    let Some(mut agent) = Agent::start().await else {
        return;
    };
    for kind in SINGLE_KINDS {
        let id = format!("ok-{}", kind.name());
        agent.send(kind.name(), kind.request(&id, OK, 30)).await;

        let ack = agent.ack(&id).await;
        assert_eq!(ack["machineId"], MACHINE);
        let (subject, result) = agent.result(&id, None).await;
        assert_eq!(subject, result_subject(kind.name()));
        assert_wire_shape(&result, false);
        assert_eq!(result["exit_code"], 0);
        assert_eq!(result["stdout"], "hi\n");
        assert_eq!(result["timed_out"], false);
        assert!(result.get("error").is_none(), "{result}");
        assert!(result.get("failure_reason").is_none(), "{result}");
        match kind {
            Kind::Command => assert!(result.get("script_id").is_none(), "{result}"),
            _ => assert_eq!(result["script_id"], format!("{id}-script")),
        }
        assert_eq!(legacy_status(&result), "SUCCESS");
    }
}

#[tokio::test]
async fn a_script_own_exit_code_carries_no_reason_on_every_kind() {
    let Some(mut agent) = Agent::start().await else {
        return;
    };
    for kind in SINGLE_KINDS {
        for (code, exit) in [(EXITS_3, 3), (EXITS_85, 85), (EXITS_98, 98)] {
            let id = format!("exit-{exit}-{}", kind.name());
            agent.send(kind.name(), kind.request(&id, code, 30)).await;

            let (subject, result) = agent.result(&id, None).await;
            assert_eq!(subject, result_subject(kind.name()));
            assert_wire_shape(&result, false);
            assert_eq!(result["exit_code"], exit);
            assert_eq!(result["stderr"], "boom\n");
            assert_eq!(result["timed_out"], false);
            assert!(result.get("error").is_none(), "{result}");
            assert!(result.get("failure_reason").is_none(), "{result}");
            assert_eq!(legacy_status(&result), "FAILED");
        }
    }
}

#[tokio::test]
async fn agent_failures_carry_their_reason_and_keep_the_legacy_fields_on_every_kind() {
    let Some(mut agent) = Agent::start().await else {
        return;
    };
    for kind in SINGLE_KINDS {
        agent
            .send(
                kind.name(),
                kind.request(&format!("timeout-{}", kind.name()), SLEEPS, 2),
            )
            .await;
        agent
            .send(
                kind.name(),
                kind.request(&format!("launch-{}", kind.name()), BAD_SHEBANG, 30),
            )
            .await;
    }

    for kind in SINGLE_KINDS {
        let (subject, timed_out) = agent
            .result(&format!("timeout-{}", kind.name()), None)
            .await;
        assert_eq!(subject, result_subject(kind.name()));
        assert_wire_shape(&timed_out, true);
        assert_eq!(timed_out["exit_code"], 98);
        assert_eq!(timed_out["timed_out"], true);
        assert!(timed_out["stderr"]
            .as_str()
            .unwrap()
            .ends_with("Script timed out after 2 seconds"));
        assert!(timed_out.get("error").is_none(), "{timed_out}");
        assert_eq!(timed_out["failure_reason"], "AGENT_TIMED_OUT");
        assert_eq!(legacy_status(&timed_out), "FAILED");

        let (subject, launch) = agent.result(&format!("launch-{}", kind.name()), None).await;
        assert_eq!(subject, result_subject(kind.name()));
        assert_wire_shape(&launch, true);
        assert_eq!(launch["exit_code"], 85);
        assert_eq!(launch["timed_out"], false);
        assert_eq!(launch["error"], launch["stderr"]);
        assert!(!launch["error"].as_str().unwrap().is_empty());
        assert_eq!(launch["failure_reason"], "COULD_NOT_LAUNCH");
        assert_eq!(legacy_status(&launch), "FAILED");
    }
}

#[tokio::test]
async fn a_schedule_reports_every_script_with_its_own_outcome() {
    let Some(mut agent) = Agent::start().await else {
        return;
    };
    agent
        .send(
            ScriptScheduleExecutionMessage::KIND,
            schedule(
                "batch",
                &[
                    ("ok", OK, 30),
                    ("exits-85", EXITS_85, 30),
                    ("times-out", SLEEPS, 2),
                    ("bad-shebang", BAD_SHEBANG, 30),
                ],
            ),
        )
        .await;

    let ack = agent.ack("batch").await;
    assert_eq!(ack["scheduleId"], SCHEDULE);
    assert_eq!(
        ack["scriptIds"],
        json!(["ok", "exits-85", "times-out", "bad-shebang"])
    );

    for (script_id, exit, reason, status) in [
        ("ok", 0, None, "SUCCESS"),
        ("exits-85", 85, None, "FAILED"),
        ("times-out", 98, Some("AGENT_TIMED_OUT"), "FAILED"),
        ("bad-shebang", 85, Some("COULD_NOT_LAUNCH"), "FAILED"),
    ] {
        let (subject, result) = agent.result("batch", Some(script_id)).await;
        assert_eq!(subject, result_subject(ScriptMessage::KIND));
        assert_wire_shape(&result, reason.is_some());
        assert_eq!(result["schedule_id"], SCHEDULE);
        assert_eq!(result["exit_code"], exit, "{script_id}");
        assert_eq!(result["failure_reason"].as_str(), reason, "{script_id}");
        assert_eq!(
            result.get("error").is_some(),
            reason == Some("COULD_NOT_LAUNCH"),
            "{script_id}"
        );
        assert_eq!(legacy_status(&result), status, "{script_id}");
    }
}

#[tokio::test]
async fn a_schedule_cut_by_a_restart_is_reported_interrupted() {
    let Some(mut agent) = Agent::boot().await else {
        return;
    };
    let subject = result_subject(ScriptMessage::KIND);
    let record = |script_id: &str, started: bool| JournalRecord {
        subject: subject.clone(),
        execution_id: "cut".into(),
        schedule_id: Some(SCHEDULE.into()),
        machine_id: MACHINE.into(),
        script_id: Some(script_id.into()),
        started,
        created_at_secs: now_secs(),
    };
    agent
        .store
        .journal_batch(
            "cut".into(),
            vec![
                (entry_key("cut", Some("running")), record("running", true)),
                (entry_key("cut", Some("pending")), record("pending", false)),
            ],
        )
        .await
        .unwrap();
    assert_eq!(agent.store.recover().await.unwrap(), 2);
    agent.flush.notify_one();

    for (script_id, error) in [
        ("running", "interrupted by agent restart; outcome unknown"),
        ("pending", "not executed: agent restarted earlier in batch"),
    ] {
        let (got, result) = agent.result("cut", Some(script_id)).await;
        assert_eq!(got, subject);
        assert_wire_shape(&result, true);
        assert_eq!(result["exit_code"], 85);
        assert_eq!(result["timed_out"], false);
        assert_eq!(result["error"], error);
        assert_eq!(result["schedule_id"], SCHEDULE);
        assert_eq!(result["failure_reason"], "INTERRUPTED");
        assert_eq!(legacy_status(&result), "FAILED");
    }
}
