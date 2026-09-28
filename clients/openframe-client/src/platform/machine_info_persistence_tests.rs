use super::*;

#[test]
fn legacy_record_without_user_id_deserializes() {
    let info = deserialize(r#"{"machine_id":"m1","client_secret":"s1"}"#).unwrap();
    assert_eq!(info.machine_id, "m1");
    assert!(info.user_id.is_none());
}

#[test]
fn user_id_round_trips() {
    let info = PersistedMachineInfo {
        machine_id: "m1".to_string(),
        client_secret: "s1".to_string(),
        user_id: Some("user-42".to_string()),
    };
    let restored = deserialize(&serialize(&info).unwrap()).unwrap();
    assert_eq!(restored.user_id.as_deref(), Some("user-42"));
}
