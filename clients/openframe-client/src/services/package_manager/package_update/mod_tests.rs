use super::*;
use crate::models::{
    FailReason, PackageRef, PackageUpdateMessage, SourceKind, UpdateMode, UpdateSource,
    UpdateStatus,
};
use crate::platform::DirectoryManager;
use crate::services::tool_run_manager::ClientUpdatePendingFlag;
use crate::utils::latch::Latch;
use run::Verdict;
use tempfile::TempDir;

const MACHINE: &str = "machine-1";

struct Fixture {
    worker: Arc<Worker>,
    orders: Arc<OrderStore>,
    events: Arc<std::sync::Mutex<Vec<crate::models::PackageUpdateStatusMessage>>>,
    agent_restart: Latch,
    _dir: TempDir,
}

impl Fixture {
    fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let directories = DirectoryManager::with_custom_dirs(
            dir.path().join("logs"),
            dir.path().join("app"),
            dir.path().join("secured"),
        );
        let config = AgentConfigurationService::new(directories).unwrap();
        let orders = Arc::new(OrderStore::load(dir.path().join("package_updates.json")));
        let (status, events) = StatusReporter::in_memory();
        let agent_restart = Latch::default();
        let worker = Arc::new(Worker {
            orders: orders.clone(),
            status,
            config,
            signals: RestartSignals {
                client_update: ClientUpdatePendingFlag::default().view(),
                agent_restart: agent_restart.view(),
            },
            package_upgrades: InProgress::default(),
        });
        Fixture {
            worker,
            orders,
            events,
            agent_restart,
            _dir: dir,
        }
    }

    fn submit(&self, request_id: &str, package: PackageRef) -> Order {
        self.orders
            .submit(
                MACHINE,
                1,
                unix_now(),
                PackageUpdateMessage {
                    request_id: request_id.to_string(),
                    source: UpdateSource {
                        kind: SourceKind::Auto,
                        origin: None,
                    },
                    package,
                    mode: UpdateMode::Wait,
                    countdown_seconds: None,
                },
                0,
            )
            .unwrap();
        self.orders.get(request_id).unwrap()
    }
}

#[tokio::test]
async fn an_order_for_an_unsupported_manager_fails_as_not_supported() {
    let f = Fixture::new();
    let order = f.submit(
        "req-1",
        PackageRef::Choco {
            id: "git".to_string(),
        },
    );
    let mut progress = Progress::default();

    let verdict = f
        .worker
        .look(MACHINE, &order, &mut progress, unix_now())
        .await;

    assert!(matches!(verdict, Verdict::Finished));
    let events = f.events.lock().unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].state, UpdateStatus::Failed);
    assert_eq!(
        events[0].failed.as_ref().map(|failed| failed.reason),
        Some(FailReason::NotSupported)
    );
}

#[tokio::test]
async fn restart_signals_are_read_from_their_sources() {
    let f = Fixture::new();
    assert!(!f.worker.signals.pending());

    f.agent_restart.set();

    assert!(f.worker.signals.pending());
}

#[test]
fn the_manager_starts_once() {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let _guard = runtime.enter();
    let f = Fixture::new();
    let manager = PackageUpdateRunManager {
        worker: f.worker.clone(),
        started: AtomicBool::new(false),
    };

    let first = manager.start();
    let second = manager.start();

    assert!(first.is_some());
    assert!(second.is_none());
    first.unwrap().abort();
}
