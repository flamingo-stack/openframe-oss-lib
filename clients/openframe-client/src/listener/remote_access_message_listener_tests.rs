use super::*;
use crate::models::Installation;

fn chat(installation: Installation, state: ToolRecordState) -> InstalledTool {
    InstalledTool {
        tool_agent_id: CHAT_TOOL_AGENT_ID.to_string(),
        installation,
        state,
        ..Default::default()
    }
}

fn gui_app() -> Installation {
    Installation::GuiApp {
        executable_path: "/Applications/OpenFrame.app/Contents/MacOS/openframe-chat".into(),
        bundle_id: Some("com.openframe.chat".into()),
    }
}

#[test]
fn subject_covers_every_remote_access_leaf_of_the_machine() {
    assert_eq!(remote_access_subject("m-1"), "machine.m-1.remote-access.>");
}

#[test]
fn one_launch_per_window_then_the_window_reopens() {
    let last = Mutex::new(None);
    let start = Instant::now();
    assert!(open_launch_window(&last, start), "first message launches");
    assert!(
        !open_launch_window(&last, start + Duration::from_secs(2)),
        "a republish two seconds later is absorbed"
    );
    assert!(
        !open_launch_window(&last, start + LAUNCH_WINDOW - Duration::from_millis(1)),
        "still inside the window"
    );
    assert!(
        open_launch_window(&last, start + LAUNCH_WINDOW),
        "the window has elapsed"
    );
    assert!(
        !open_launch_window(&last, start + LAUNCH_WINDOW + Duration::from_secs(1)),
        "the new window starts at the launch that reopened it"
    );
}

#[test]
fn an_installed_gui_app_chat_is_launched() {
    let tool = launchable_chat(Some(chat(gui_app(), ToolRecordState::Installed)));
    assert_eq!(
        tool.map(|t| t.tool_agent_id).as_deref(),
        Some(CHAT_TOOL_AGENT_ID)
    );
}

#[test]
fn a_missing_chat_is_not_launched() {
    assert!(launchable_chat(None).is_none());
}

#[test]
fn a_chat_still_installing_is_not_launched() {
    assert!(launchable_chat(Some(chat(gui_app(), ToolRecordState::Installing))).is_none());
}

#[test]
fn a_non_gui_app_chat_record_is_not_launched() {
    let standard = Installation::Standard {
        executable_path: Some("agent".into()),
    };
    assert!(launchable_chat(Some(chat(standard, ToolRecordState::Installed))).is_none());
}
