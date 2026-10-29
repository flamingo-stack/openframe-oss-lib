use super::{launchable_gui_app, shutdown_break};
use crate::models::{Installation, InstalledTool, ToolRecordState};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::RwLock;

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
