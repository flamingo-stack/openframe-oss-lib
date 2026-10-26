use super::*;

#[test]
fn record_with_legacy_first_run_still_loads() {
    let json = r#"[{
        "tool_agent_id": "openframe-chat",
        "tool_id": "chat",
        "tool_type": "gui",
        "version": "1.0.0",
        "run_command_args": [],
        "tool_agent_id_command_args": [],
        "first_run": "pending"
    }]"#;
    let tools: Vec<InstalledTool> = serde_json::from_str(json).unwrap();

    assert_eq!(tools.len(), 1);
    assert_eq!(tools[0].tool_agent_id, "openframe-chat");
    assert!(!serde_json::to_string(&tools).unwrap().contains("first_run"));
}
