use super::{launchable_gui_app, shutdown_break, ClientUpdatePendingFlag, ToolRunManager};
use crate::models::{Installation, InstalledTool, ToolRecordState};
use crate::platform::DirectoryManager;
use crate::services::{
    AgentConfigurationService, InitialConfigurationService, InstalledToolsService,
    ToolCommandParamsResolver, ToolKillService, ToolOps,
};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tempfile::TempDir;
use tokio::sync::RwLock;

const LONG_TTL: Duration = Duration::from_secs(3600);

#[test]
fn not_pending_before_first_mark() {
    let flag = ClientUpdatePendingFlag::default();
    assert!(!flag.is_pending(LONG_TTL));
}

#[test]
fn pending_after_mark_within_ttl() {
    let flag = ClientUpdatePendingFlag::default();
    flag.mark();
    assert!(flag.is_pending(LONG_TTL));
}

#[test]
fn expired_when_ttl_elapsed() {
    let flag = ClientUpdatePendingFlag::default();
    flag.mark();
    assert!(!flag.is_pending(Duration::ZERO));
}

#[tokio::test]
async fn remark_refreshes_the_ttl() {
    let flag = ClientUpdatePendingFlag::default();
    flag.mark();
    tokio::time::sleep(Duration::from_millis(30)).await;
    assert!(!flag.is_pending(Duration::from_millis(10)));
    flag.mark();
    assert!(flag.is_pending(Duration::from_millis(10)));
}

#[test]
fn clones_share_state() {
    let flag = ClientUpdatePendingFlag::default();
    let clone = flag.clone();
    clone.mark();
    assert!(flag.is_pending(LONG_TTL));
}

#[tokio::test]
async fn shutdown_break_drops_supervision_only_once_signalled() {
    let shutting_down = AtomicBool::new(false);
    let running_tools = RwLock::new(HashSet::from(["mesh".to_string()]));
    assert!(!shutdown_break(&shutting_down, &running_tools, "mesh").await);
    assert!(running_tools.read().await.contains("mesh"));

    shutting_down.store(true, Ordering::Release);
    assert!(shutdown_break(&shutting_down, &running_tools, "mesh").await);
    assert!(!running_tools.read().await.contains("mesh"));
}

#[test]
fn clear_releases_the_flag() {
    let flag = ClientUpdatePendingFlag::default();
    flag.mark();
    assert!(flag.is_pending(LONG_TTL));
    flag.clear();
    assert!(!flag.is_pending(LONG_TTL));
}

#[test]
fn the_view_follows_the_flag() {
    let flag = ClientUpdatePendingFlag::default();
    let view = flag.view();
    assert!(!view.is_pending());

    flag.mark();
    assert!(view.is_pending());

    flag.clear();
    assert!(!view.is_pending());
}

fn gui_app_record(state: ToolRecordState) -> InstalledTool {
    InstalledTool {
        tool_agent_id: "openframe-chat".to_string(),
        installation: Installation::GuiApp {
            executable_path: "/Applications/OpenFrame.app/Contents/MacOS/openframe-chat".into(),
            bundle_id: Some("com.openframe.chat".into()),
        },
        state,
        ..Default::default()
    }
}

#[test]
fn an_installed_gui_app_is_launchable() {
    let tool = launchable_gui_app(Some(gui_app_record(ToolRecordState::Installed)));
    assert_eq!(
        tool.map(|t| t.tool_agent_id).as_deref(),
        Some("openframe-chat")
    );
}

#[test]
fn a_missing_record_is_not_launchable() {
    assert!(launchable_gui_app(None).is_none());
}

#[test]
fn a_record_still_installing_is_not_launchable() {
    assert!(launchable_gui_app(Some(gui_app_record(ToolRecordState::Installing))).is_none());
}

#[test]
fn a_standard_record_is_not_launchable() {
    let standard = InstalledTool {
        installation: Installation::Standard {
            executable_path: Some("agent".into()),
        },
        ..gui_app_record(ToolRecordState::Installed)
    };
    assert!(launchable_gui_app(Some(standard)).is_none());
}

#[cfg(any(windows, target_os = "macos"))]
#[test]
fn chat_always_launches_in_background() {
    use super::gui_launch_flag;
    use crate::models::CHAT_TOOL_AGENT_ID;

    assert_eq!(gui_launch_flag(CHAT_TOOL_AGENT_ID), Some("--background"));
    assert_eq!(gui_launch_flag("other-tool"), None);
}

const FLEET: &str = "fleetmdm-agent";

struct RepairFixture {
    _dir: TempDir,
    directory_manager: DirectoryManager,
    installed_tools: InstalledToolsService,
    manager: ToolRunManager,
}

fn repair_fixture() -> RepairFixture {
    let dir = TempDir::new().unwrap();
    let root = dir.path();
    let directory_manager = DirectoryManager::with_custom_dirs(
        root.join("logs"),
        root.join("app_support"),
        root.join("secured"),
    );
    let installed_tools = InstalledToolsService::new(directory_manager.clone()).unwrap();
    let manager = ToolRunManager::new(
        installed_tools.clone(),
        ToolCommandParamsResolver::new(
            directory_manager.clone(),
            InitialConfigurationService::new(directory_manager.clone()).unwrap(),
            AgentConfigurationService::new(directory_manager.clone()).unwrap(),
        ),
        ToolKillService::new(),
        ToolOps::default(),
    );
    RepairFixture {
        _dir: dir,
        directory_manager,
        installed_tools,
        manager,
    }
}

async fn fleet_left_installing(f: &RepairFixture) {
    f.installed_tools
        .save(InstalledTool {
            tool_agent_id: FLEET.to_string(),
            run_command_args: vec![
                "--openframe-osquery-path".to_string(),
                "${client.assetPath.osqueryd}".to_string(),
            ],
            installation: Installation::Standard {
                executable_path: None,
            },
            state: ToolRecordState::Installing,
            ..Default::default()
        })
        .await
        .unwrap();
    std::fs::create_dir_all(f.directory_manager.get_tool_folder(FLEET)).unwrap();
    std::fs::write(f.directory_manager.get_agent_path(FLEET), b"orbit").unwrap();
}

async fn state_after_startup_repair(f: &RepairFixture) -> ToolRecordState {
    assert!(f.manager.try_mark_running(FLEET).await);
    f.manager.run().await.unwrap();
    f.installed_tools
        .get_by_tool_agent_id(FLEET)
        .await
        .unwrap()
        .expect("record kept")
        .state
}

#[tokio::test]
async fn a_record_left_installing_without_the_asset_its_command_launches_stays_installing() {
    let f = repair_fixture();
    fleet_left_installing(&f).await;

    assert_eq!(
        state_after_startup_repair(&f).await,
        ToolRecordState::Installing
    );
}

#[tokio::test]
async fn a_record_left_installing_with_its_binary_and_assets_is_marked_installed() {
    let f = repair_fixture();
    fleet_left_installing(&f).await;
    std::fs::write(
        f.directory_manager.get_asset_path(FLEET, "osqueryd", true),
        b"osqueryd",
    )
    .unwrap();

    assert_eq!(
        state_after_startup_repair(&f).await,
        ToolRecordState::Installed
    );
}
