use super::*;
use serde_json::json;

fn event(state: AdoptState, message: &str) -> PackageAdoptStatusMessage {
    PackageAdoptStatusMessage {
        event_id: "e-1".to_string(),
        request_id: "req-1".to_string(),
        machine_id: "m-1".to_string(),
        at: "2026-11-19T10:00:00.000Z".to_string(),
        state,
        message: message.to_string(),
    }
}

#[test]
fn the_subject_is_machine_scoped() {
    assert_eq!(
        package_adopt_status_subject("abc"),
        "machine.abc.package-adopt.status"
    );
}

#[test]
fn a_done_event_matches_the_contract_shape() {
    let done = event(
        AdoptState::Done {
            outcome: AdoptOutcome::Reinstalled,
            restart_required: true,
        },
        "Reinstalled through Homebrew; the user should restart the app",
    );

    assert_eq!(
        serde_json::to_value(&done).unwrap(),
        json!({
            "eventId": "e-1",
            "requestId": "req-1",
            "machineId": "m-1",
            "at": "2026-11-19T10:00:00.000Z",
            "state": "DONE",
            "outcome": "REINSTALLED",
            "restartRequired": true,
            "message": "Reinstalled through Homebrew; the user should restart the app"
        })
    );
}

#[test]
fn a_failed_event_matches_the_contract_shape() {
    let failed = event(
        AdoptState::Failed {
            reason: AdoptFailReason::IdentityMismatch,
        },
        "the app at /Applications/Firefox.app is com.example.other, not org.mozilla.firefox",
    );

    assert_eq!(
        serde_json::to_value(&failed).unwrap(),
        json!({
            "eventId": "e-1",
            "requestId": "req-1",
            "machineId": "m-1",
            "at": "2026-11-19T10:00:00.000Z",
            "state": "FAILED",
            "reason": "IDENTITY_MISMATCH",
            "message": "the app at /Applications/Firefox.app is com.example.other, not org.mozilla.firefox"
        })
    );
}
