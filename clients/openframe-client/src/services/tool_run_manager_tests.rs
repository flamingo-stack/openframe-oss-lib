use super::{launchable_gui_app, shutdown_break, ClientUpdatePendingFlag};
use crate::models::{Installation, InstalledTool, ToolRecordState};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tokio::sync::RwLock;

const LONG_TTL: Duration = Duration::from_secs(3600);

#[tokio::test]
async fn not_pending_before_first_mark() {
    let flag = ClientUpdatePendingFlag::default();
    assert!(!flag.is_pending(LONG_TTL).await);
}

#[tokio::test]
async fn pending_after_mark_within_ttl() {
    let flag = ClientUpdatePendingFlag::default();
    flag.mark().await;
    assert!(flag.is_pending(LONG_TTL).await);
}

#[tokio::test]
async fn expired_when_ttl_elapsed() {
    let flag = ClientUpdatePendingFlag::default();
    flag.mark().await;
    assert!(!flag.is_pending(Duration::ZERO).await);
}

#[tokio::test]
async fn remark_refreshes_the_ttl() {
    let flag = ClientUpdatePendingFlag::default();
    flag.mark().await;
    tokio::time::sleep(Duration::from_millis(30)).await;
    assert!(!flag.is_pending(Duration::from_millis(10)).await);
    flag.mark().await;
    assert!(flag.is_pending(Duration::from_millis(10)).await);
}

#[tokio::test]
async fn clones_share_state() {
    let flag = ClientUpdatePendingFlag::default();
    let clone = flag.clone();
    clone.mark().await;
    assert!(flag.is_pending(LONG_TTL).await);
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

#[tokio::test]
async fn clear_releases_the_flag() {
    let flag = ClientUpdatePendingFlag::default();
    flag.mark().await;
    assert!(flag.is_pending(LONG_TTL).await);
    flag.clear().await;
    assert!(!flag.is_pending(LONG_TTL).await);
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
