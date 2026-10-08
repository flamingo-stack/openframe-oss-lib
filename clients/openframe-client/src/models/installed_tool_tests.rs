use super::*;

#[test]
fn record_without_first_run_deserializes_as_done() {
    let json = r#"{
        "tool_agent_id": "openframe-chat",
        "tool_id": "chat",
        "tool_type": "gui",
        "version": "1.0.0",
        "run_command_args": [],
        "tool_agent_id_command_args": []
    }"#;
    let tool: InstalledTool = serde_json::from_str(json).unwrap();

    assert_eq!(tool.first_run, FirstRunState::Done);
}

#[test]
fn first_run_pending_round_trips() {
    let tool = InstalledTool {
        tool_agent_id: "openframe-chat".to_string(),
        first_run: FirstRunState::Pending,
        ..Default::default()
    };
    let json = serde_json::to_string(&tool).unwrap();

    assert!(json.contains(r#""first_run":"pending""#));
    let parsed: InstalledTool = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.first_run, FirstRunState::Pending);
}
