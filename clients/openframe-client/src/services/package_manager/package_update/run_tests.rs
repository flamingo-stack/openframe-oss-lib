use std::cell::Cell;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};

use async_trait::async_trait;
use tempfile::TempDir;

use super::*;
use crate::models::{
    BrewKind, PackageRef, PackageUpdateMessage, PackageUpdateStatusMessage, SourceKind,
    UpdateSource, UpdateStatus,
};
use crate::platform::process_snapshot::RunningProcess;
use crate::platform::DirectoryManager;
use crate::services::package_manager::package_update::machine::Machine;
use crate::services::package_manager::package_update::managers::Probe as Found;
use crate::services::package_manager::package_update::{
    OrderStore, RestartSignals, StatusReporter,
};
use crate::services::package_manager::update_gate::MainImages;
use crate::services::tool_run_manager::ClientUpdatePendingFlag;
use crate::services::AgentConfigurationService;
use crate::utils::in_progress::{InProgress, InProgressView};
use crate::utils::latch::Latch;

const MACHINE: &str = "machine-1";
const NOW: u64 = 1_000_000;
const APP: u32 = 7;

#[derive(Debug, Clone, PartialEq)]
enum Call {
    Probe,
    Close(Vec<u32>),
    Upgrade,
    Reread,
    Reopen { image: PathBuf, upgrading: bool },
}

/// What the fake device answers; a test edits it between looks.
struct Device {
    user: bool,
    probe: Result<Found, QueryError>,
    reread: Result<Found, QueryError>,
    identity: Result<AppIdentity, Undetermined>,
    running: Vec<RunningProcess>,
    survivors: Vec<u32>,
    upgrade: UpgradeOutcome,
    calls: Vec<Call>,
}

struct Fake {
    device: Arc<Mutex<Device>>,
    upgrades: InProgressView,
}

impl Fake {
    fn device(&self) -> MutexGuard<'_, Device> {
        self.device.lock().unwrap()
    }
}

#[async_trait]
impl Machine for Fake {
    async fn console_user_present(&self) -> bool {
        self.device().user
    }

    async fn presence(&self, _manager: ManagerId) -> Presence {
        Presence::Present
    }

    async fn probe(&self, _package: &PackageRef) -> Result<Found, QueryError> {
        let mut device = self.device();
        device.calls.push(Call::Probe);
        device.probe.clone()
    }

    async fn resolve(&self, _package: &PackageRef) -> Result<AppIdentity, Undetermined> {
        self.device().identity.clone()
    }

    async fn snapshot(&self) -> Result<Vec<RunningProcess>, Undetermined> {
        Ok(self.device().running.clone())
    }

    async fn close(&self, pids: &[u32]) -> Vec<u32> {
        let mut device = self.device();
        device.calls.push(Call::Close(pids.to_vec()));
        let survivors = device.survivors.clone();
        device
            .running
            .retain(|process| survivors.contains(&process.pid) || !pids.contains(&process.pid));
        survivors
    }

    async fn upgrade(&self, _package: &PackageRef) -> UpgradeOutcome {
        let mut device = self.device();
        device.calls.push(Call::Upgrade);
        device.upgrade.clone()
    }

    async fn reread(&self, _package: &PackageRef) -> Result<Found, QueryError> {
        let mut device = self.device();
        device.calls.push(Call::Reread);
        device.reread.clone()
    }

    async fn reopen(&self, image: &Path, _session: Option<u32>, _user: Option<&str>) -> bool {
        let upgrading = self.upgrades.is_active();
        self.device().calls.push(Call::Reopen {
            image: image.to_path_buf(),
            upgrading,
        });
        true
    }

    fn session_user(&self, _session: Option<u32>) -> Option<String> {
        Some("jane".to_string())
    }
}

fn found(state: ProbeState, installed: &str, available: &str) -> Result<Found, QueryError> {
    Ok(Found {
        state,
        installed_version: Some(installed.to_string()),
        available_version: Some(available.to_string()),
    })
}

struct Fixture {
    worker: Worker,
    orders: Arc<OrderStore>,
    events: Arc<Mutex<Vec<PackageUpdateStatusMessage>>>,
    device: Arc<Mutex<Device>>,
    agent_restart: Latch,
    app: PathBuf,
    sequence: Cell<i64>,
    _dir: TempDir,
}

impl Fixture {
    /// An outdated cask (1.0 → 2.0) whose app is installed under a temp dir and not running.
    fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let install_dir = dir.path().join("App.app");
        std::fs::create_dir_all(&install_dir).unwrap();
        let app = install_dir.join("app");
        std::fs::write(&app, b"").unwrap();
        let device = Arc::new(Mutex::new(Device {
            user: true,
            probe: found(ProbeState::Outdated, "1.0", "2.0"),
            reread: found(ProbeState::UpToDate, "2.0", "2.0"),
            identity: Ok(AppIdentity::App {
                install_dir,
                main_images: MainImages::Derived(vec!["app".to_string()]),
            }),
            running: Vec::new(),
            survivors: Vec::new(),
            upgrade: UpgradeOutcome::Upgraded {
                reboot_required: false,
            },
            calls: Vec::new(),
        }));
        let config = AgentConfigurationService::new(DirectoryManager::with_custom_dirs(
            dir.path().join("logs"),
            dir.path().join("app"),
            dir.path().join("secured"),
        ))
        .unwrap();
        let orders = Arc::new(OrderStore::load(dir.path().join("package_updates.json")));
        let (status, events) = StatusReporter::in_memory();
        let agent_restart = Latch::default();
        let package_upgrades = InProgress::default();
        let worker = Worker {
            machine: Box::new(Fake {
                device: device.clone(),
                upgrades: package_upgrades.view(),
            }),
            orders: orders.clone(),
            status,
            config,
            signals: RestartSignals {
                client_update: ClientUpdatePendingFlag::default().view(),
                agent_restart: agent_restart.view(),
            },
            package_upgrades,
        };
        Fixture {
            worker,
            orders,
            events,
            device,
            agent_restart,
            app,
            sequence: Cell::new(0),
            _dir: dir,
        }
    }

    fn device(&self) -> MutexGuard<'_, Device> {
        self.device.lock().unwrap()
    }

    fn app_runs(&self, pid: u32) {
        let image = self.app.clone();
        self.device().running.push(RunningProcess {
            pid,
            image,
            parent_image: None,
            is_service: false,
            session: None,
        });
    }

    fn submit(&self, request_id: &str, mode: UpdateMode, countdown: u64) -> Order {
        self.sequence.set(self.sequence.get() + 1);
        self.orders
            .submit(
                MACHINE,
                self.sequence.get(),
                NOW,
                PackageUpdateMessage {
                    request_id: request_id.to_string(),
                    source: UpdateSource {
                        kind: SourceKind::Auto,
                        origin: None,
                    },
                    package: PackageRef::Brew {
                        kind: BrewKind::Cask,
                        name: "app".to_string(),
                    },
                    mode,
                    countdown_seconds: Some(countdown),
                },
                countdown,
            )
            .unwrap();
        self.orders.get(request_id).unwrap()
    }

    async fn look(&self, order: &Order, p: &mut Progress, now: u64) -> bool {
        matches!(
            self.worker.look(MACHINE, order, p, now).await,
            Verdict::Finished
        )
    }

    fn calls(&self) -> Vec<Call> {
        self.device().calls.clone()
    }

    fn last(&self) -> PackageUpdateStatusMessage {
        self.events.lock().unwrap().last().cloned().unwrap()
    }

    fn reopened(&self, upgrading: bool) -> Call {
        Call::Reopen {
            image: self.app.clone(),
            upgrading,
        }
    }

    /// A FORCE order with a 60 s countdown over the running app, looked at until the countdown ends.
    async fn forced(&self, p: &mut Progress) -> bool {
        self.app_runs(APP);
        let order = self.submit("req-1", UpdateMode::Force, 60);
        assert!(!self.look(&order, p, NOW).await);
        self.look(&order, p, NOW + 60).await
    }
}

fn waiting(event: &PackageUpdateStatusMessage) -> (WaitReason, WaitPhase) {
    let waiting = event.waiting.as_ref().unwrap();
    (waiting.reason, waiting.phase)
}

#[test]
fn a_holder_is_named_by_its_image_file() {
    let holder = Holder {
        pid: 42,
        image: std::path::PathBuf::from(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ),
        session: None,
    };

    let info = holder_info(&holder, Some("jane".to_string()));

    assert_eq!(info.app, "Google Chrome");
    assert_eq!(info.user.as_deref(), Some("jane"));
}

#[tokio::test]
async fn a_wait_order_holds_while_the_app_runs_and_installs_once_it_is_closed() {
    let f = Fixture::new();
    f.app_runs(APP);
    let order = f.submit("req-1", UpdateMode::Wait, 0);
    let mut p = Progress::default();

    assert!(!f.look(&order, &mut p, NOW).await);
    assert_eq!(
        waiting(&f.last()),
        (WaitReason::AppRunning, WaitPhase::Prompt)
    );
    assert_eq!(
        f.last().waiting.unwrap().holders[0].user.as_deref(),
        Some("jane")
    );
    assert!(!f.calls().contains(&Call::Upgrade));

    f.device().running.clear();
    assert!(f.look(&order, &mut p, NOW + POLL_SECS).await);

    let done = f.last();
    assert_eq!(done.state, UpdateStatus::Done);
    assert_eq!(done.done.as_ref().unwrap().result, DoneResult::Upgraded);
    assert!(!done.done.unwrap().relaunched);
    assert_eq!(done.installed_version.as_deref(), Some("2.0"));
    assert_eq!(f.calls(), [Call::Probe, Call::Upgrade, Call::Reread]);
}

#[tokio::test]
async fn a_force_order_counts_down_closes_the_app_installs_and_relaunches_it() {
    let f = Fixture::new();
    f.app_runs(APP);
    let order = f.submit("req-1", UpdateMode::Force, 60);
    let mut p = Progress::default();

    assert!(!f.look(&order, &mut p, NOW).await);
    assert_eq!(
        waiting(&f.last()),
        (WaitReason::AppRunning, WaitPhase::Countdown)
    );
    assert!(f.last().waiting.unwrap().closes_at.is_some());
    assert!(!f.look(&order, &mut p, NOW + 30).await);
    assert_eq!(f.calls(), [Call::Probe]);

    assert!(f.look(&order, &mut p, NOW + 60).await);

    let done = f.last();
    assert_eq!(done.state, UpdateStatus::Done);
    assert!(done.done.unwrap().relaunched);
    assert_eq!(done.installed_version.as_deref(), Some("2.0"));
    assert_eq!(
        f.calls(),
        [
            Call::Probe,
            Call::Close(vec![APP]),
            Call::Upgrade,
            Call::Reread,
            f.reopened(true)
        ]
    );
}

#[tokio::test]
async fn a_restart_waits_until_the_closed_apps_are_back() {
    let f = Fixture::new();
    let mut p = Progress::default();

    assert!(f.forced(&mut p).await);

    assert!(f.calls().contains(&f.reopened(true)));
    assert!(!f.worker.package_upgrades.view().is_active());
}

#[tokio::test]
async fn a_restart_pending_when_the_countdown_ends_closes_nothing() {
    let f = Fixture::new();
    f.app_runs(APP);
    let order = f.submit("req-1", UpdateMode::Force, 60);
    let mut p = Progress::default();
    assert!(!f.look(&order, &mut p, NOW).await);

    f.agent_restart.set();
    assert!(!f.look(&order, &mut p, NOW + 60).await);

    assert_eq!(f.calls(), [Call::Probe]);
    assert!(!f.worker.package_upgrades.view().is_active());
}

#[tokio::test]
async fn a_superseded_order_neither_closes_nor_installs() {
    let f = Fixture::new();
    f.app_runs(APP);
    let first = f.submit("req-1", UpdateMode::Force, 60);
    let mut p = Progress::default();
    assert!(!f.look(&first, &mut p, NOW).await);
    let reported = f.events.lock().unwrap().len();

    f.submit("req-2", UpdateMode::Force, 60);
    assert!(f.look(&first, &mut p, NOW + 60).await);

    assert_eq!(f.calls(), [Call::Probe]);
    assert_eq!(f.events.lock().unwrap().len(), reported);
}

#[tokio::test]
async fn without_a_console_user_the_order_waits_for_one_without_probing() {
    let f = Fixture::new();
    f.device().user = false;
    let order = f.submit("req-1", UpdateMode::Force, 60);

    assert!(!f.look(&order, &mut Progress::default(), NOW).await);

    assert_eq!(
        waiting(&f.last()),
        (WaitReason::NoUserSession, WaitPhase::Prompt)
    );
    assert!(f.calls().is_empty());
}

#[tokio::test]
async fn the_probe_alone_ends_an_order_that_needs_no_install() {
    let cases = [
        (
            found(ProbeState::UpToDate, "2.0", "2.0"),
            UpdateStatus::Done,
            None,
        ),
        (
            found(ProbeState::NotInstalled, "", ""),
            UpdateStatus::Failed,
            Some(FailReason::NotInstalled),
        ),
        (
            found(
                ProbeState::NotUpgradable("pinned".to_string()),
                "1.0",
                "2.0",
            ),
            UpdateStatus::Failed,
            Some(FailReason::NotUpgradable),
        ),
    ];
    for (probe, state, reason) in cases {
        let f = Fixture::new();
        f.app_runs(APP);
        f.device().probe = probe;
        let order = f.submit("req-1", UpdateMode::Force, 60);

        assert!(f.look(&order, &mut Progress::default(), NOW).await);

        let event = f.last();
        assert_eq!(event.state, state);
        assert_eq!(event.failed.map(|failed| failed.reason), reason);
        assert_eq!(f.calls(), [Call::Probe]);
    }
}

#[tokio::test]
async fn an_app_left_running_after_the_close_fails_the_order_and_the_closed_one_comes_back() {
    let f = Fixture::new();
    f.app_runs(8);
    f.device().survivors = vec![8];
    let mut p = Progress::default();

    assert!(f.forced(&mut p).await);

    assert_eq!(f.last().failed.unwrap().reason, FailReason::CloseFailed);
    assert!(!f.calls().contains(&Call::Upgrade));
    assert!(f.calls().contains(&f.reopened(true)));
}

#[tokio::test]
async fn an_app_in_use_after_the_forced_close_fails_and_comes_back() {
    let f = Fixture::new();
    f.device().upgrade = UpgradeOutcome::InUse("files in use".to_string());
    let mut p = Progress::default();

    assert!(f.forced(&mut p).await);

    assert_eq!(f.last().failed.unwrap().reason, FailReason::CloseFailed);
    assert!(f.calls().contains(&f.reopened(true)));
}

#[tokio::test]
async fn a_busy_manager_keeps_the_closed_apps_closed_until_the_hour_runs_out() {
    let f = Fixture::new();
    f.device().upgrade = UpgradeOutcome::Busy("another install".to_string());
    let mut p = Progress::default();

    assert!(!f.forced(&mut p).await);
    assert_eq!(
        waiting(&f.last()),
        (WaitReason::ManagerBusy, WaitPhase::Prompt)
    );
    assert!(!f
        .calls()
        .iter()
        .any(|call| matches!(call, Call::Reopen { .. })));

    let order = f.orders.get("req-1").unwrap();
    assert!(f.look(&order, &mut p, NOW + 60 + BUSY_BUDGET_SECS).await);

    assert_eq!(f.last().failed.unwrap().reason, FailReason::Timeout);
    assert!(f.calls().contains(&f.reopened(true)));
}

#[tokio::test]
async fn a_re_sent_order_is_probed_again() {
    let f = Fixture::new();
    f.app_runs(APP);
    let order = f.submit("req-1", UpdateMode::Wait, 0);
    let mut p = Progress::default();
    assert!(!f.look(&order, &mut p, NOW).await);
    assert!(!f.look(&order, &mut p, NOW + POLL_SECS).await);

    let resent = f.submit("req-1", UpdateMode::Wait, 0);
    assert!(!f.look(&resent, &mut p, NOW + 2 * POLL_SECS).await);

    let probes = f
        .calls()
        .iter()
        .filter(|call| **call == Call::Probe)
        .count();
    assert_eq!(probes, 2);
}

#[tokio::test]
async fn already_latest_from_the_manager_reports_the_version_read_after_it() {
    let f = Fixture::new();
    f.device().upgrade = UpgradeOutcome::AlreadyLatest;
    let order = f.submit("req-1", UpdateMode::Wait, 0);

    assert!(f.look(&order, &mut Progress::default(), NOW).await);

    let done = f.last();
    assert_eq!(done.done.unwrap().result, DoneResult::AlreadyLatest);
    assert_eq!(done.installed_version.as_deref(), Some("2.0"));
    assert_eq!(f.calls(), [Call::Probe, Call::Upgrade, Call::Reread]);
}
