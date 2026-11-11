use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};

use async_trait::async_trait;
use futures::StreamExt;
use serde_json::json;
use tempfile::TempDir;
use tokio::sync::Notify;
use tokio::task::JoinHandle;
use tokio::time::{timeout, Duration};

use super::machine::Machine;
use super::managers::{Probe, ProbeState, QueryError, UpgradeOutcome};
use super::{run, OrderStore, RestartSignals, StatusReporter, Worker};
use crate::listener::command::{
    CommandContext, CommandListener, PackageUpdateHandler, RestartGate,
};
use crate::models::{
    DeliveryResult, DeliveryResultMessage, FailReason, PackageRef, PackageUpdateStatusMessage,
    UpdateStatus,
};
use crate::platform::process_snapshot::RunningProcess;
use crate::platform::DirectoryManager;
use crate::services::delivery_results::DeliveryResults;
use crate::services::execution_service::ExecutionService;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::package_manager::update_gate::{AppIdentity, MainImages, Undetermined};
use crate::services::package_manager::{is_supported, ManagerId, Presence};
use crate::services::result_outbox_run_manager::ResultOutboxRunManager;
use crate::services::result_store::{LedgerState, ResultStore};
use crate::services::tool_run_manager::ClientUpdatePendingFlag;
use crate::services::{AgentConfigurationService, InitialConfigurationService, ToolOps};
use crate::test_support::{connection_manager, NatsServer};
use crate::utils::in_progress::InProgress;
use crate::utils::latch::Latch;

const MACHINE: &str = "end-to-end-machine";
const BOUND: Duration = Duration::from_secs(15);
const QUIET: Duration = Duration::from_millis(700);

/// One app on the fake device, keyed by its package name.
struct App {
    probe: ProbeState,
    running: bool,
    upgrade: UpgradeOutcome,
    hold: Option<Arc<Notify>>,
}

impl Default for App {
    fn default() -> Self {
        Self {
            probe: ProbeState::Outdated,
            running: false,
            upgrade: UpgradeOutcome::Upgraded {
                reboot_required: false,
            },
            hold: None,
        }
    }
}

#[derive(Default)]
struct Device {
    root: PathBuf,
    apps: BTreeMap<String, App>,
    upgrades: Vec<String>,
}

impl Device {
    fn app(&mut self, name: &str) -> &mut App {
        self.apps.entry(name.to_string()).or_default()
    }

    fn pid(&self, name: &str) -> u32 {
        1000 + self.apps.keys().position(|key| key == name).unwrap_or(0) as u32
    }
}

#[derive(Clone)]
struct Fake(Arc<Mutex<Device>>);

impl Fake {
    fn device(&self) -> MutexGuard<'_, Device> {
        self.0.lock().unwrap()
    }
}

fn name_of(package: &PackageRef) -> String {
    match package {
        PackageRef::Brew { name, .. } => name.clone(),
        PackageRef::Winget { id } | PackageRef::Choco { id } => id.clone(),
    }
}

#[async_trait]
impl Machine for Fake {
    async fn console_user_present(&self) -> bool {
        true
    }

    async fn presence(&self, _manager: ManagerId) -> Presence {
        Presence::Present
    }

    async fn probe(&self, package: &PackageRef) -> Result<Probe, QueryError> {
        let state = self.device().app(&name_of(package)).probe.clone();
        Ok(Probe {
            state,
            installed_version: Some("1.0".to_string()),
            available_version: Some("2.0".to_string()),
        })
    }

    async fn resolve(&self, package: &PackageRef) -> Result<AppIdentity, Undetermined> {
        let name = name_of(package);
        Ok(AppIdentity::App {
            install_dir: self.device().root.join(&name),
            main_images: MainImages::Derived(vec!["app".to_string()]),
        })
    }

    async fn snapshot(&self) -> Result<Vec<RunningProcess>, Undetermined> {
        let device = self.device();
        Ok(device
            .apps
            .iter()
            .filter(|(_, app)| app.running)
            .map(|(name, _)| RunningProcess {
                pid: device.pid(name),
                image: device.root.join(name).join("app"),
                parent_image: None,
                is_service: false,
                session: None,
            })
            .collect())
    }

    async fn close(&self, pids: &[u32]) -> Vec<u32> {
        let mut device = self.device();
        let closed: Vec<String> = device
            .apps
            .keys()
            .filter(|name| pids.contains(&device.pid(name)))
            .cloned()
            .collect();
        for name in closed {
            device.app(&name).running = false;
        }
        Vec::new()
    }

    async fn upgrade(&self, package: &PackageRef) -> UpgradeOutcome {
        let name = name_of(package);
        let (hold, outcome) = {
            let mut device = self.device();
            device.upgrades.push(name.clone());
            let app = device.app(&name);
            (app.hold.clone(), app.upgrade.clone())
        };
        if let Some(hold) = hold {
            hold.notified().await;
        }
        outcome
    }

    async fn reread(&self, _package: &PackageRef) -> Result<Probe, QueryError> {
        Ok(Probe {
            state: ProbeState::UpToDate,
            installed_version: Some("2.0".to_string()),
            available_version: Some("2.0".to_string()),
        })
    }

    async fn reopen(&self, _image: &Path, _session: Option<u32>, _user: Option<&str>) -> bool {
        true
    }

    fn session_user(&self, _session: Option<u32>) -> Option<String> {
        None
    }
}

/// The agent's package-update path against a real NATS server: listener, ledger, outbox and worker, with a fake
/// device under the worker.
struct Bench {
    _server: NatsServer,
    _dir: TempDir,
    directories: DirectoryManager,
    tester: async_nats::Client,
    results: async_nats::Subscriber,
    statuses: async_nats::Subscriber,
    unclaimed: Vec<DeliveryResultMessage>,
    unclaimed_statuses: Vec<PackageUpdateStatusMessage>,
    manager: NatsConnectionManager,
    config: AgentConfigurationService,
    publisher: NatsMessagePublisher,
    store: Arc<ResultStore>,
    flush: Arc<Notify>,
    fake: Fake,
    tasks: Vec<JoinHandle<()>>,
    orders: Option<Arc<OrderStore>>,
    probes: u32,
}

impl Bench {
    async fn start() -> Option<Self> {
        let package: PackageRef = serde_json::from_value(package_json("probe")).unwrap();
        if !is_supported(ManagerId::of(&package)) {
            return None;
        }
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
        let _initial = InitialConfigurationService::new(directories.clone()).unwrap();
        let manager = connection_manager(server.url(), &directories, &config);
        manager.use_client_for_tests(async_nats::connect(server.url()).await.unwrap());

        let tester = async_nats::connect(server.url()).await.unwrap();
        let jetstream = async_nats::jetstream::new(tester.clone());
        for (name, subject) in [
            ("DELIVERY_RESULT", "machine.*.delivery.result"),
            ("PACKAGE_UPDATE_STATUS", "machine.*.package-update.status"),
        ] {
            jetstream
                .create_stream(async_nats::jetstream::stream::Config {
                    name: name.into(),
                    subjects: vec![subject.into()],
                    ..Default::default()
                })
                .await
                .unwrap();
        }
        let results = tester
            .subscribe(format!("machine.{MACHINE}.delivery.result"))
            .await
            .unwrap();
        let statuses = tester
            .subscribe(format!("machine.{MACHINE}.package-update.status"))
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

        let fake = Fake(Arc::new(Mutex::new(Device {
            root: dir.path().join("apps"),
            ..Device::default()
        })));
        let mut bench = Self {
            _server: server,
            _dir: dir,
            directories,
            tester,
            results,
            statuses,
            unclaimed: Vec::new(),
            unclaimed_statuses: Vec::new(),
            manager,
            config,
            publisher,
            store,
            flush,
            fake,
            tasks: Vec::new(),
            orders: None,
            probes: 0,
        };
        bench.launch().await;
        Some(bench)
    }

    /// Starts the listener and a worker over the fake device from what is on disk, as a fresh agent process would.
    async fn launch(&mut self) {
        let orders = Arc::new(OrderStore::load(
            self.directories.secured_dir().join("package_updates.json"),
        ));
        let status = StatusReporter::new(
            self.publisher.clone(),
            self.store.clone(),
            self.flush.clone(),
        );
        let results = DeliveryResults::new(
            self.publisher.clone(),
            self.store.clone(),
            self.flush.clone(),
        );
        let package_upgrades = InProgress::default();
        let gate = RestartGate::new(
            ToolOps::default().busy_tools(),
            ExecutionService::new().running_scripts(),
            ClientUpdatePendingFlag::default().view(),
            package_upgrades.view(),
            Latch::default(),
        );
        let context = CommandContext::new(
            self.manager.clone(),
            self.config.clone(),
            gate,
            results.clone(),
            self.store.clone(),
            self.flush.clone(),
        );
        let listener = CommandListener::new(
            PackageUpdateHandler::new(orders.clone(), status.clone(), results.clone()),
            context,
        )
        .start()
        .await
        .unwrap();
        self.tasks.push(listener);
        self.until_listening().await;
        let worker = Worker {
            machine: Box::new(self.fake.clone()),
            orders: orders.clone(),
            status,
            results,
            config: self.config.clone(),
            signals: RestartSignals {
                client_update: ClientUpdatePendingFlag::default().view(),
                agent_restart: Latch::default().view(),
            },
            package_upgrades,
        };
        self.tasks.push(tokio::spawn(run(Arc::new(worker))));
        self.orders = Some(orders);
    }

    /// Stops the listener and the worker as a process exit would; the disk and the outbox stay.
    fn stop(&mut self) {
        for task in self.tasks.drain(..) {
            task.abort();
        }
        self.orders = None;
    }

    async fn restart(&mut self) {
        self.stop();
        tokio::task::yield_now().await;
        self.launch().await;
    }

    fn orders(&self) -> &OrderStore {
        self.orders.as_ref().unwrap()
    }

    async fn until_listening(&mut self) {
        self.probes += 1;
        let probe = format!("probe-{}", self.probes);
        timeout(BOUND, async {
            loop {
                self.send(json!({"delivery": {
                    "type": "PACKAGE_UPDATE",
                    "targetId": "probe",
                    "dispatchId": probe,
                    "sequence": 0,
                }}))
                .await;
                if timeout(
                    Duration::from_millis(200),
                    self.next_result(&probe, DeliveryResult::Failed),
                )
                .await
                .is_ok()
                {
                    return;
                }
            }
        })
        .await
        .expect("the package-update listener never answered");
    }

    fn device(&self) -> MutexGuard<'_, Device> {
        self.fake.device()
    }

    async fn send(&self, payload: serde_json::Value) {
        self.tester
            .publish(
                format!("machine.{MACHINE}.package-update"),
                serde_json::to_vec(&payload).unwrap().into(),
            )
            .await
            .unwrap();
        self.tester.flush().await.unwrap();
    }

    async fn next_result(
        &mut self,
        dispatch_id: &str,
        expected: DeliveryResult,
    ) -> DeliveryResultMessage {
        let matches = |result: &DeliveryResultMessage| {
            result.delivery.dispatch_id == dispatch_id && result.result == expected
        };
        if let Some(index) = self.unclaimed.iter().position(matches) {
            return self.unclaimed.remove(index);
        }
        loop {
            let message = self
                .results
                .next()
                .await
                .expect("result subscription ended");
            let result: DeliveryResultMessage = serde_json::from_slice(&message.payload).unwrap();
            if matches(&result) {
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
        match timeout(BOUND, self.next_result(dispatch_id, expected)).await {
            Ok(result) => result,
            Err(_) => {
                let ledger = self.ledger(dispatch_id).await;
                let pending: Vec<_> = self
                    .orders
                    .as_ref()
                    .map(|orders| orders.pending(MACHINE))
                    .unwrap_or_default();
                panic!(
                    "no {expected:?} for {dispatch_id}; heard {:?}; upgrades {:?}; ledger {ledger:?}; pending {pending:?}",
                    self.unclaimed,
                    self.device().upgrades
                )
            }
        }
    }

    /// Nothing but `allowed` arrives for `dispatch_id` within the quiet window.
    async fn expect_only(&mut self, dispatch_id: &str, allowed: &[DeliveryResult]) {
        let _ = timeout(QUIET, async {
            loop {
                let message = self
                    .results
                    .next()
                    .await
                    .expect("result subscription ended");
                let result: DeliveryResultMessage =
                    serde_json::from_slice(&message.payload).unwrap();
                self.unclaimed.push(result);
            }
        })
        .await;
        let heard: Vec<DeliveryResult> = self
            .unclaimed
            .iter()
            .filter(|result| result.delivery.dispatch_id == dispatch_id)
            .map(|result| result.result)
            .collect();
        assert!(
            heard.iter().all(|result| allowed.contains(result)),
            "{dispatch_id}: heard {heard:?}, only {allowed:?} allowed"
        );
    }

    async fn status(
        &mut self,
        request_id: &str,
        state: UpdateStatus,
    ) -> PackageUpdateStatusMessage {
        let matches = |event: &PackageUpdateStatusMessage| {
            event.request_id == request_id && event.state == state
        };
        timeout(BOUND, async {
            if let Some(index) = self.unclaimed_statuses.iter().position(matches) {
                return self.unclaimed_statuses.remove(index);
            }
            loop {
                let message = self
                    .statuses
                    .next()
                    .await
                    .expect("status subscription ended");
                let event: PackageUpdateStatusMessage =
                    serde_json::from_slice(&message.payload).unwrap();
                if matches(&event) {
                    return event;
                }
                self.unclaimed_statuses.push(event);
            }
        })
        .await
        .unwrap_or_else(|_| panic!("no {state:?} status for {request_id}"))
    }

    async fn ledger(&self, dispatch_id: &str) -> Option<LedgerState> {
        self.store
            .delivery_state(dispatch_id.to_string())
            .await
            .unwrap()
    }

    // the flusher removes a key once its publish is acked, so a re-queue of the same key in that gap is dropped
    async fn until_flushed(&self) {
        timeout(BOUND, async {
            while self.store.len().await.unwrap() > 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("the outbox never drained");
    }

    async fn until_upgrading(&self, name: &str) {
        timeout(BOUND, async {
            while self.upgrades_of(name) == 0 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap_or_else(|_| panic!("the install of {name} never started"));
    }

    fn upgrades_of(&self, name: &str) -> usize {
        self.device()
            .upgrades
            .iter()
            .filter(|upgraded| *upgraded == name)
            .count()
    }
}

fn package_json(name: &str) -> serde_json::Value {
    if cfg!(windows) {
        json!({"manager": "WINGET", "id": name})
    } else {
        json!({"manager": "BREW", "kind": "CASK", "name": name})
    }
}

struct Order<'a> {
    dispatch: &'a str,
    target: &'a str,
    sequence: i64,
    request: &'a str,
    package: &'a str,
    mode: &'a str,
    origin: &'a str,
    countdown: Option<u64>,
}

impl<'a> Order<'a> {
    fn wait(dispatch: &'a str, sequence: i64, request: &'a str, package: &'a str) -> Self {
        Self {
            dispatch,
            target: request,
            sequence,
            request,
            package,
            mode: "WAIT",
            origin: "ADMIN",
            countdown: None,
        }
    }

    /// The end user's Update now: FORCE with no countdown.
    fn update_now(dispatch: &'a str, sequence: i64, request: &'a str, package: &'a str) -> Self {
        Self {
            mode: "FORCE",
            origin: "USER",
            countdown: Some(0),
            ..Self::wait(dispatch, sequence, request, package)
        }
    }

    fn json(&self) -> serde_json::Value {
        json!({
            "delivery": {
                "type": "PACKAGE_UPDATE",
                "targetId": self.target,
                "dispatchId": self.dispatch,
                "sequence": self.sequence,
            },
            "requestId": self.request,
            "source": {"kind": "MANUAL", "origin": self.origin},
            "package": package_json(self.package),
            "mode": self.mode,
            "countdownSeconds": self.countdown,
        })
    }
}

#[tokio::test]
async fn an_order_is_acked_at_once_and_done_only_after_its_install() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    let hold = Arc::new(Notify::new());
    b.device().app("alpha").hold = Some(hold.clone());

    b.send(Order::wait("d1", 1, "req-1", "alpha").json()).await;

    b.expect("d1", DeliveryResult::Acked).await;
    b.until_upgrading("alpha").await;
    b.expect_only("d1", &[DeliveryResult::Acked]).await;
    assert_eq!(b.ledger("d1").await, Some(LedgerState::Deferred));

    hold.notify_one();

    b.status("req-1", UpdateStatus::Done).await;
    b.expect("d1", DeliveryResult::Done).await;
    assert_eq!(b.upgrades_of("alpha"), 1);
    assert!(b.orders().pending(MACHINE).is_empty());
}

#[tokio::test]
async fn a_waiting_order_blocks_neither_the_listener_nor_another_package() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    b.device().app("alpha").running = true;

    b.send(Order::wait("a1", 1, "req-a", "alpha").json()).await;
    b.expect("a1", DeliveryResult::Acked).await;
    b.status("req-a", UpdateStatus::Waiting).await;
    b.send(Order::wait("b1", 2, "req-b", "beta").json()).await;

    b.expect("b1", DeliveryResult::Acked).await;
    b.status("req-b", UpdateStatus::Done).await;
    b.expect("b1", DeliveryResult::Done).await;
    b.expect_only("a1", &[DeliveryResult::Acked]).await;
    assert_eq!(b.upgrades_of("alpha"), 0);
    assert_eq!(b.orders().pending(MACHINE).len(), 1);
}

#[tokio::test]
async fn orders_arriving_while_an_install_runs_are_all_acked_and_all_answered_after() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    let hold = Arc::new(Notify::new());
    b.device().app("pkg-00").hold = Some(hold.clone());
    b.send(Order::wait("d00", 1, "req-00", "pkg-00").json())
        .await;
    b.expect("d00", DeliveryResult::Acked).await;
    b.until_upgrading("pkg-00").await;

    let names: Vec<String> = (1..=15).map(|i| format!("pkg-{i:02}")).collect();
    for (i, name) in names.iter().enumerate() {
        let dispatch = format!("d{:02}", i + 1);
        let request = format!("req-{:02}", i + 1);
        b.send(Order::wait(&dispatch, i as i64 + 2, &request, name).json())
            .await;
    }
    for i in 1..=15 {
        b.expect(&format!("d{i:02}"), DeliveryResult::Acked).await;
    }
    assert_eq!(b.orders().pending(MACHINE).len(), 16);

    hold.notify_one();

    b.expect("d00", DeliveryResult::Done).await;
    for i in 1..=15 {
        b.expect(&format!("d{i:02}"), DeliveryResult::Done).await;
    }
    for name in &names {
        assert_eq!(b.upgrades_of(name), 1, "{name}");
    }
}

#[tokio::test]
async fn update_now_on_a_waiting_order_answers_both_dispatches_once_installed() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    b.device().app("alpha").running = true;
    b.send(Order::wait("wait", 1, "req-1", "alpha").json())
        .await;
    b.expect("wait", DeliveryResult::Acked).await;
    b.status("req-1", UpdateStatus::Waiting).await;

    b.send(Order::update_now("now", 2, "req-1", "alpha").json())
        .await;

    b.expect("now", DeliveryResult::Acked).await;
    b.status("req-1", UpdateStatus::Done).await;
    b.expect("wait", DeliveryResult::Done).await;
    b.expect("now", DeliveryResult::Done).await;
    assert_eq!(b.upgrades_of("alpha"), 1);
    assert!(
        !b.device().app("alpha").running,
        "the forced close stopped it"
    );
}

#[tokio::test]
async fn a_repeat_of_a_waiting_dispatch_is_acked_again_and_never_runs_twice() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    let hold = Arc::new(Notify::new());
    b.device().app("alpha").hold = Some(hold.clone());
    let order = Order::wait("d1", 1, "req-1", "alpha").json();
    b.send(order.clone()).await;
    b.expect("d1", DeliveryResult::Acked).await;

    for _ in 0..3 {
        b.send(order.clone()).await;
        b.expect("d1", DeliveryResult::Acked).await;
    }
    hold.notify_one();

    b.expect("d1", DeliveryResult::Done).await;
    b.until_flushed().await;
    b.send(order).await;
    b.expect("d1", DeliveryResult::Done).await;
    b.expect_only("d1", &[]).await;
    assert_eq!(b.upgrades_of("alpha"), 1);
}

#[tokio::test]
async fn an_older_rerun_arriving_during_the_install_is_answered_with_it() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    let hold = Arc::new(Notify::new());
    b.device().app("alpha").hold = Some(hold.clone());
    b.send(Order::wait("d1", 5, "req-1", "alpha").json()).await;
    b.expect("d1", DeliveryResult::Acked).await;
    b.until_upgrading("alpha").await;

    b.send(Order::wait("rerun", 5, "req-1", "alpha").json())
        .await;
    b.expect("rerun", DeliveryResult::Acked).await;
    let mut deadline = Order::update_now("deadline", 9, "req-1", "alpha");
    deadline.target = "req-1:deadline";
    b.send(deadline.json()).await;
    b.expect("deadline", DeliveryResult::Acked).await;
    hold.notify_one();

    b.expect("d1", DeliveryResult::Done).await;
    b.expect("rerun", DeliveryResult::Done).await;
    b.expect("deadline", DeliveryResult::Done).await;
    assert_eq!(b.upgrades_of("alpha"), 1);
}

#[tokio::test]
async fn a_retryable_failure_is_failed_and_the_engine_rerun_installs_again() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    b.device().app("alpha").upgrade = UpgradeOutcome::Failed {
        exit_code: 1,
        message: "boom".to_string(),
    };
    b.send(Order::wait("d1", 3, "req-1", "alpha").json()).await;
    b.expect("d1", DeliveryResult::Acked).await;
    let failed = b.expect("d1", DeliveryResult::Failed).await;
    assert!(
        failed.error.as_deref().unwrap_or_default().contains("boom"),
        "{failed:?}"
    );
    let event = b.status("req-1", UpdateStatus::Failed).await;
    assert_eq!(
        event.failed.map(|failed| failed.reason),
        Some(FailReason::ManagerError)
    );

    b.device().app("alpha").upgrade = UpgradeOutcome::Upgraded {
        reboot_required: false,
    };
    b.send(Order::wait("rerun", 3, "req-1", "alpha").json())
        .await;

    b.expect("rerun", DeliveryResult::Acked).await;
    b.expect("rerun", DeliveryResult::Done).await;
    assert_eq!(b.upgrades_of("alpha"), 2);
    b.until_flushed().await;
    b.send(Order::wait("d1", 3, "req-1", "alpha").json()).await;
    let repeat = b.expect("d1", DeliveryResult::Failed).await;
    assert_eq!(
        repeat, failed,
        "a repeat of the failed dispatch gets its stored result"
    );
    assert_eq!(b.upgrades_of("alpha"), 2);
}

#[tokio::test]
async fn failures_a_rerun_cannot_fix_are_done_and_never_installed_again() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    b.device().app("gone").probe = ProbeState::NotInstalled;
    b.device().app("pinned").probe = ProbeState::NotUpgradable("pinned".to_string());

    b.send(Order::wait("g1", 1, "req-g", "gone").json()).await;
    b.send(Order::wait("p1", 2, "req-p", "pinned").json()).await;

    b.expect("g1", DeliveryResult::Done).await;
    b.expect("p1", DeliveryResult::Done).await;
    let gone = b.status("req-g", UpdateStatus::Failed).await;
    assert_eq!(
        gone.failed.map(|failed| failed.reason),
        Some(FailReason::NotInstalled)
    );
    let pinned = b.status("req-p", UpdateStatus::Failed).await;
    assert_eq!(
        pinned.failed.map(|failed| failed.reason),
        Some(FailReason::NotUpgradable)
    );
    b.send(Order::wait("g2", 1, "req-g", "gone").json()).await;
    b.expect("g2", DeliveryResult::Done).await;
    assert!(b.device().upgrades.is_empty());
}

#[tokio::test]
async fn a_late_rerun_of_an_order_that_ended_done_is_done_without_installing() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    b.send(Order::wait("d1", 4, "req-1", "alpha").json()).await;
    b.expect("d1", DeliveryResult::Acked).await;
    b.expect("d1", DeliveryResult::Done).await;

    b.send(Order::wait("rerun", 4, "req-1", "alpha").json())
        .await;

    b.expect("rerun", DeliveryResult::Acked).await;
    b.expect("rerun", DeliveryResult::Done).await;
    assert_eq!(b.upgrades_of("alpha"), 1);
}

#[tokio::test]
async fn a_superseded_order_is_done_at_once_and_the_new_one_carries_on() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    b.device().app("alpha").running = true;
    b.send(Order::wait("old", 1, "req-old", "alpha").json())
        .await;
    b.expect("old", DeliveryResult::Acked).await;

    b.send(Order::wait("new", 2, "req-new", "alpha").json())
        .await;

    b.expect("new", DeliveryResult::Acked).await;
    b.expect("old", DeliveryResult::Done).await;
    let event = b.status("req-old", UpdateStatus::Failed).await;
    assert_eq!(
        event.failed.map(|failed| failed.reason),
        Some(FailReason::Superseded)
    );
    b.expect_only("new", &[DeliveryResult::Acked]).await;
    let pending = b.orders().pending(MACHINE);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].request_id, "req-new");
}

#[tokio::test]
async fn a_restart_keeps_a_waiting_order_and_answers_it_after() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    b.device().app("alpha").running = true;
    b.send(Order::wait("d1", 1, "req-1", "alpha").json()).await;
    b.expect("d1", DeliveryResult::Acked).await;
    b.status("req-1", UpdateStatus::Waiting).await;

    b.restart().await;

    b.expect_only("d1", &[DeliveryResult::Acked]).await;
    assert_eq!(b.ledger("d1").await, Some(LedgerState::Deferred));
    assert_eq!(b.orders().pending(MACHINE).len(), 1);
    b.send(Order::wait("d1", 1, "req-1", "alpha").json()).await;
    b.expect("d1", DeliveryResult::Acked).await;
    b.device().app("alpha").running = false;
    b.restart().await;

    b.expect("d1", DeliveryResult::Done).await;
    assert_eq!(b.upgrades_of("alpha"), 1);
}

#[tokio::test]
async fn restarts_after_an_order_ended_never_install_it_again() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    b.send(Order::wait("d1", 1, "req-1", "alpha").json()).await;
    b.expect("d1", DeliveryResult::Acked).await;
    b.expect("d1", DeliveryResult::Done).await;

    b.restart().await;
    b.restart().await;

    b.expect_only("d1", &[]).await;
    assert_eq!(b.upgrades_of("alpha"), 1);
    assert!(b.orders().pending(MACHINE).is_empty());
}

#[tokio::test]
async fn a_crash_during_an_install_re_probes_and_answers_the_dispatch_from_before() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    let hold = Arc::new(Notify::new());
    b.device().app("alpha").hold = Some(hold);
    b.send(Order::wait("d1", 1, "req-1", "alpha").json()).await;
    b.expect("d1", DeliveryResult::Acked).await;
    b.until_upgrading("alpha").await;

    b.stop();
    {
        let mut device = b.device();
        let app = device.app("alpha");
        app.hold = None;
        app.probe = ProbeState::UpToDate;
    }
    b.launch().await;

    b.expect("d1", DeliveryResult::Done).await;
    let event = b.status("req-1", UpdateStatus::Done).await;
    assert!(event.done.is_some());
    assert_eq!(
        b.upgrades_of("alpha"),
        1,
        "the manager already had it, nothing installs again"
    );
}

#[tokio::test]
async fn a_new_request_for_a_package_being_installed_waits_and_both_are_answered() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    let hold = Arc::new(Notify::new());
    b.device().app("alpha").hold = Some(hold.clone());
    b.send(Order::wait("first", 1, "req-1", "alpha").json())
        .await;
    b.expect("first", DeliveryResult::Acked).await;
    b.until_upgrading("alpha").await;

    b.send(Order::wait("second", 2, "req-2", "alpha").json())
        .await;
    b.expect("second", DeliveryResult::Acked).await;
    b.expect_only("first", &[DeliveryResult::Acked]).await;
    assert_eq!(
        b.orders().pending(MACHINE).len(),
        2,
        "a running install is not superseded"
    );
    b.device().app("alpha").hold = None;
    hold.notify_one();

    b.expect("first", DeliveryResult::Done).await;
    b.expect("second", DeliveryResult::Done).await;
    assert_eq!(b.upgrades_of("alpha"), 2);
}

#[tokio::test]
async fn a_dispatch_whose_order_was_lost_fails_on_start_and_its_rerun_installs() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    b.device().app("alpha").running = true;
    b.send(Order::wait("lost", 1, "req-1", "alpha").json())
        .await;
    b.expect("lost", DeliveryResult::Acked).await;
    b.status("req-1", UpdateStatus::Waiting).await;
    b.device().app("beta").running = true;
    b.send(Order::wait("kept", 2, "req-2", "beta").json()).await;
    b.expect("kept", DeliveryResult::Acked).await;
    b.status("req-2", UpdateStatus::Waiting).await;

    b.stop();
    let path = b.directories.secured_dir().join("package_updates.json");
    std::fs::write(&path, b"{ not json").unwrap();
    b.device().app("alpha").running = false;
    b.launch().await;

    let failed = b.expect("lost", DeliveryResult::Failed).await;
    assert_eq!(
        failed.error.as_deref(),
        Some("the agent lost the work it took on")
    );
    let other = b.expect("kept", DeliveryResult::Failed).await;
    assert_eq!(
        other.error, failed.error,
        "the unreadable file lost both orders"
    );
    assert!(b.orders().pending(MACHINE).is_empty());
    assert_eq!(b.upgrades_of("alpha"), 0);

    b.send(Order::wait("rerun", 1, "req-1", "alpha").json())
        .await;

    b.expect("rerun", DeliveryResult::Acked).await;
    b.expect("rerun", DeliveryResult::Done).await;
    assert_eq!(b.upgrades_of("alpha"), 1);
}

#[tokio::test]
async fn a_restart_fails_only_the_dispatches_no_order_holds() {
    let Some(mut b) = Bench::start().await else {
        return;
    };
    b.device().app("alpha").running = true;
    b.send(Order::wait("held", 1, "req-1", "alpha").json())
        .await;
    b.expect("held", DeliveryResult::Acked).await;
    b.status("req-1", UpdateStatus::Waiting).await;
    let orphan = crate::models::DeliveryRef {
        delivery_type: "PACKAGE_UPDATE".to_string(),
        target_id: "req-gone".to_string(),
        dispatch_id: "orphan".to_string(),
        sequence: Some(7),
    };
    b.store
        .delivery_accept(
            format!("machine.{MACHINE}.delivery.result"),
            orphan,
            LedgerState::InFlight,
        )
        .await
        .unwrap();
    b.store.delivery_defer("orphan".to_string()).await.unwrap();

    b.restart().await;

    b.expect("orphan", DeliveryResult::Failed).await;
    b.expect_only("held", &[DeliveryResult::Acked]).await;
    assert_eq!(b.ledger("held").await, Some(LedgerState::Deferred));
    assert_eq!(b.orders().pending(MACHINE).len(), 1);
}
