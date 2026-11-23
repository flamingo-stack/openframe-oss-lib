use super::*;

#[test]
fn the_subject_is_per_machine() {
    assert_eq!(identity_split_subject("m-1"), "machine.m-1.identity-split");
}

#[test]
fn the_message_is_camel_case() {
    let message: IdentitySplitMessage = serde_json::from_str(r#"{"sessionId":"s-1"}"#).unwrap();

    assert_eq!(message.session_id, "s-1");
    assert_eq!(
        serde_json::to_value(&message).unwrap(),
        serde_json::json!({ "sessionId": "s-1" })
    );
}
