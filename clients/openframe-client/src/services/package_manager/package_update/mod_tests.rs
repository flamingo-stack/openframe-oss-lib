use super::*;
use crate::platform::DirectoryManager;
use crate::services::tool_run_manager::ClientUpdatePendingFlag;
use crate::utils::latch::Latch;
use tempfile::TempDir;

struct Fixture {
    worker: Arc<Worker>,
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
        let (status, _events) = StatusReporter::in_memory();
        let agent_restart = Latch::default();
        let worker = Arc::new(Worker {
            machine: Box::new(System),
            orders,
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
            agent_restart,
            _dir: dir,
        }
    }
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
