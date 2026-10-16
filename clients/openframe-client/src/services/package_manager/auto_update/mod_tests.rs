use super::*;
use crate::models::UpdatePolicy;
use crate::services::tool_run_manager::ClientUpdatePendingFlag;
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
                agent_restart: self.agent_restart.clone(),
            },
            InProgress::default(),
            ToolKillService::new(),
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
        manager.worker.force(&winget("Other.App")).await,
        ForceResult::NotInPolicy
    );
}

#[tokio::test]
async fn force_is_unavailable_while_the_agent_is_restarting() {
    let fixture = Fixture::with_policy(&[choco("git")]);
    let (manager, _force_now) = fixture.manager();
    fixture.agent_restart.set();

    assert!(matches!(
        manager.worker.force(&choco("git")).await,
        ForceResult::Unavailable(_)
    ));
}

#[tokio::test]
async fn force_on_an_unsupported_manager_is_unavailable() {
    let fixture = Fixture::with_policy(&[choco("git")]);
    let (manager, _force_now) = fixture.manager();

    assert!(matches!(
        manager.worker.force(&choco("git")).await,
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

    let not_before = manager.worker.pass(&mut state, &mut force).await;

    assert_eq!(not_before, 0, "an unsupported manager is not a silent one");
    assert!(!UpdateState::load(&fixture.state_path()).is_due(unix_now(), None, &[]));
}

#[test]
fn managers_come_once_each_whatever_the_policy_order() {
    let policy: Vec<PolicyEntry> = [winget("A"), choco("b"), winget("C")]
        .into_iter()
        .map(|package| PolicyEntry {
            package,
            policy: UpdatePolicy::default(),
        })
        .collect();

    assert_eq!(
        managers_in(&policy),
        vec![ManagerId::Choco, ManagerId::Winget]
    );
}

#[test]
fn last_line_skips_trailing_blank_lines() {
    assert_eq!(last_line("one\ntwo\n\n  \n"), "two");
    assert_eq!(last_line(""), "");
}

#[tokio::test]
async fn closing_holders_stops_them_even_when_they_ignore_the_request() {
    let fixture = Fixture::with_policy(&[]);
    let (manager, _force_now) = fixture.manager();
    let mut app = if cfg!(target_os = "windows") {
        std::process::Command::new("ping")
            .args(["-n", "120", "127.0.0.1"])
            .stdout(std::process::Stdio::null())
            .spawn()
            .unwrap()
    } else {
        std::process::Command::new("sleep")
            .arg("120")
            .spawn()
            .unwrap()
    };

    timeout(CLOSE_GRACE + BOUND, manager.worker.close(&[app.id()]))
        .await
        .expect("closing the holders hung");

    let exited = timeout(BOUND, async {
        loop {
            if app.try_wait().unwrap().is_some() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await;
    if exited.is_err() {
        let _ = app.kill();
        panic!("the holder survived its forced close");
    }
}

#[tokio::test]
async fn closing_nothing_returns_at_once() {
    let fixture = Fixture::with_policy(&[]);
    let (manager, _force_now) = fixture.manager();

    timeout(Duration::from_secs(1), manager.worker.close(&[]))
        .await
        .expect("an empty close waited");
}
