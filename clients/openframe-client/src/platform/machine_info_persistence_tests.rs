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
        local_machine_id: None,
    };
    let restored = deserialize(&serialize(&info).unwrap()).unwrap();
    assert_eq!(restored.user_id.as_deref(), Some("user-42"));
}

#[test]
fn legacy_record_without_local_machine_id_deserializes() {
    let info = deserialize(r#"{"machine_id":"m1","client_secret":"s1","user_id":"u1"}"#).unwrap();
    assert!(info.local_machine_id.is_none());
}

#[test]
fn local_machine_id_round_trips() {
    let info = PersistedMachineInfo {
        machine_id: "m1".to_string(),
        client_secret: "s1".to_string(),
        user_id: None,
        local_machine_id: Some("3fb3956d-8c56-4fd0-8262-b8a3e9539219".to_string()),
    };
    let restored = deserialize(&serialize(&info).unwrap()).unwrap();
    assert_eq!(
        restored.local_machine_id.as_deref(),
        Some("3fb3956d-8c56-4fd0-8262-b8a3e9539219")
    );
}

#[test]
fn debug_shows_the_local_machine_id_and_hides_the_secret() {
    let info = PersistedMachineInfo {
        machine_id: "m1".to_string(),
        client_secret: "s1".to_string(),
        user_id: None,
        local_machine_id: Some("local-1".to_string()),
    };
    let printed = format!("{:?}", info);
    assert!(printed.contains("local-1"));
    assert!(!printed.contains("s1\""));
}
