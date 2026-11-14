use super::*;

#[test]
fn installed_agent_message_keeps_its_wire_shape() {
    let message = InstalledAgentMessage {
        agent_type: "openframe-client".to_string(),
        version: "1.5.103".to_string(),
    };

    assert_eq!(
        serde_json::to_string(&message).unwrap(),
        r#"{"agentType":"openframe-client","version":"1.5.103"}"#
    );
}
