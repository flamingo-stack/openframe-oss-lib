use super::*;

#[test]
fn the_heartbeat_carries_the_session_of_this_process() {
    let json = serde_json::to_value(MachineHeartbeatMessage::new()).unwrap();

    assert_eq!(
        json,
        serde_json::json!({ "sessionId": agent_session::session_id() })
    );
}
