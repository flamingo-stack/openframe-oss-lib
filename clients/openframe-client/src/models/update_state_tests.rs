use super::{UpdatePhase, UpdateState};

#[test]
fn state_without_last_error_still_loads() {
    let json = r#"{"target_version":"1.3.1","phase":"updater_launched","boot_attempts":2,"started_at":"2026-09-02T23:14:26Z"}"#;
    let state: UpdateState = serde_json::from_str(json).unwrap();
    assert_eq!(state.phase, UpdatePhase::UpdaterLaunched);
    assert_eq!(state.boot_attempts, 2);
    assert_eq!(state.last_error, None);
}

// Shape written back by the updater script's Set-UpdatePhase (ConvertTo-Json, pretty-printed, reordered).
#[test]
fn script_stamped_failure_loads_with_reason() {
    let json = r#"{
    "last_error":  "PowerShell 4.0: The term 'Expand-Archive' is not recognized",
    "phase":  "failed",
    "target_version":  "1.3.1",
    "boot_attempts":  0,
    "started_at":  "2026-09-02T23:14:26Z"
}"#;
    let state: UpdateState = serde_json::from_str(json).unwrap();
    assert_eq!(state.phase, UpdatePhase::Failed);
    assert_eq!(
        state.last_error.as_deref(),
        Some("PowerShell 4.0: The term 'Expand-Archive' is not recognized")
    );
}

#[test]
fn failed_phase_serializes_snake_case() {
    let mut state = UpdateState::new("1.3.1".to_string());
    state.set_phase(UpdatePhase::Failed);
    let json = serde_json::to_string(&state).unwrap();
    assert!(json.contains(r#""phase":"failed""#));
    assert!(json.contains(r#""last_error":null"#));
}
