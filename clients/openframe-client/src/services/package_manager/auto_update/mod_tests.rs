use super::*;
use crate::models::{PolicyEntry, UpdatePolicy};
use crate::services::tool_run_manager::ClientUpdatePendingFlag;
use crate::utils::latch::Latch;
use tempfile::TempDir;
use tokio::time::timeout;

const BOUND: Duration = Duration::from_secs(10);
const MACHINE: &str = "machine-1";

struct Fixture {
    dir: TempDir,
    store: Arc<PolicyStore>,
    agent_restart: Latch,
}

impl Fixture {
    fn with_policy(packages: &[PackageRef]) -> Self {
        let dir = tempfile::tempdir().unwrap();
        let store = Arc::new(PolicyStore::load(dir.path().join("package_policy.json")));
        let entries = packages
            .iter()
            .map(|package| PolicyEntry {
                package: package.clone(),
                policy: UpdatePolicy::default(),
            })
            .collect();
        store.apply(MACHINE, 1, entries).unwrap();
        Fixture {
            dir,
            store,
            agent_restart: Latch::default(),
        }
    }

    fn state_path(&self) -> PathBuf {
        self.dir.path().join("package_update_state.json")
    }

    fn manager(&self) -> (PackageAutoUpdateRunManager, ForceNow) {
        PackageAutoUpdateRunManager::new(
            self.store.clone(),
            self.state_path(),
            RestartSignals {
                client_update: ClientUpdatePendingFlag::default().view(),
                agent_restart: self.agent_restart.view(),
            },
            InProgress::default(),
        )
    }
}

fn choco(id: &str) -> PackageRef {
    PackageRef::Choco { id: id.to_string() }
}

fn winget(id: &str) -> PackageRef {
    PackageRef::Winget { id: id.to_string() }
}

#[tokio::test]
async fn force_rejects_a_package_outside_the_policy() {
    let fixture = Fixture::with_policy(&[choco("git")]);
    let (manager, _force_now) = fixture.manager();

    assert_eq!(
        manager
            .worker
            .force(&mut UpdateState::default(), &winget("Other.App"))
            .await,
        ForceResult::NotInPolicy
    );
}

#[tokio::test]
async fn force_is_unavailable_while_the_agent_is_restarting() {
    let fixture = Fixture::with_policy(&[choco("git")]);
    let (manager, _force_now) = fixture.manager();
    fixture.agent_restart.set();

    assert!(matches!(
        manager
            .worker
            .force(&mut UpdateState::default(), &choco("git"))
            .await,
        ForceResult::Unavailable(_)
    ));
}

#[tokio::test]
async fn force_on_an_unsupported_manager_is_unavailable() {
    let fixture = Fixture::with_policy(&[choco("git")]);
    let (manager, _force_now) = fixture.manager();

    assert!(matches!(
        manager
            .worker
            .force(&mut UpdateState::default(), &choco("git"))
            .await,
        ForceResult::Unavailable(_)
    ));
}

#[tokio::test]
async fn force_now_without_a_running_manager_is_unavailable() {
    let fixture = Fixture::with_policy(&[]);
    let (manager, force_now) = fixture.manager();
    drop(manager);

    assert!(matches!(
        force_now.request(choco("git")).await,
        ForceResult::Unavailable(_)
    ));
}

#[tokio::test]
async fn force_now_is_answered_by_the_running_loop() {
    let fixture = Fixture::with_policy(&[choco("git")]);
    let (manager, force_now) = fixture.manager();
    let running = manager.start().expect("first start");
    assert!(manager.start().is_none(), "a second start is refused");

    let answer = timeout(BOUND, force_now.request(winget("Other.App")))
        .await
        .expect("the loop never answered");

    assert_eq!(answer, ForceResult::NotInPolicy);
    running.abort();
}

#[tokio::test]
async fn a_pass_over_an_unsupported_manager_completes_and_is_saved() {
    let fixture = Fixture::with_policy(&[choco("git")]);
    let (manager, _force_now) = fixture.manager();
    let (_requests, mut force) = mpsc::channel(1);
    let mut state = UpdateState::default();

    let retry_at = manager.worker.pass(&mut state, &mut force).await;

    assert_eq!(retry_at, None, "an unsupported manager is not a silent one");
    assert!(!UpdateState::load(&fixture.state_path()).is_due(unix_now(), None, &[]));
}
