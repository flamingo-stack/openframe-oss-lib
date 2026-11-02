use super::*;
use crate::models::{SourceKind, SourceOrigin};
use serde_json::json;

fn base(state: UpdateStatus) -> PackageUpdateStatusMessage {
    PackageUpdateStatusMessage {
        event_id: "e-1".to_string(),
        request_id: "req-1".to_string(),
        machine_id: "m-1".to_string(),
        at: "2026-10-20T14:03:05Z".to_string(),
        source: UpdateSource {
            kind: SourceKind::Manual,
            origin: Some(SourceOrigin::User),
        },
        package: PackageRef::Winget {
            id: "Google.Chrome".to_string(),
        },
        installed_version: Some("130.0".to_string()),
        available_version: Some("131.0".to_string()),
        state,
        waiting: None,
        done: None,
        failed: None,
    }
}

#[test]
fn the_subject_is_machine_scoped() {
    assert_eq!(
        package_update_status_subject("abc"),
        "machine.abc.package-update.status"
    );
}

#[test]
fn a_waiting_event_matches_the_contract_shape() {
    let event = PackageUpdateStatusMessage {
        waiting: Some(Waiting {
            reason: WaitReason::AppRunning,
            phase: WaitPhase::Countdown,
            holders: vec![HolderInfo {
                app: "chrome.exe".to_string(),
                user: Some("jane".to_string()),
            }],
            closes_at: Some("2026-10-20T14:08:05Z".to_string()),
        }),
        ..base(UpdateStatus::Waiting)
    };

    assert_eq!(
        serde_json::to_value(&event).unwrap(),
        json!({
            "eventId": "e-1",
            "requestId": "req-1",
            "machineId": "m-1",
            "at": "2026-10-20T14:03:05Z",
            "source": {"kind": "MANUAL", "origin": "USER"},
            "package": {"manager": "WINGET", "id": "Google.Chrome"},
            "installedVersion": "130.0",
            "availableVersion": "131.0",
            "state": "WAITING",
            "waiting": {
                "reason": "APP_RUNNING",
                "phase": "COUNTDOWN",
                "holders": [{"app": "chrome.exe", "user": "jane"}],
                "closesAt": "2026-10-20T14:08:05Z"
            }
        })
    );
}

#[test]
fn done_and_failed_carry_only_their_own_object() {
    let done = PackageUpdateStatusMessage {
        done: Some(Done {
            result: DoneResult::Upgraded,
            reboot_required: false,
            relaunched: true,
        }),
        ..base(UpdateStatus::Done)
    };
    let failed = PackageUpdateStatusMessage {
        failed: Some(Failed {
            reason: FailReason::ManagerError,
            exit_code: Some(0x8A15_0068),
            message: Some("Installer failed".to_string()),
        }),
        ..base(UpdateStatus::Failed)
    };

    let done = serde_json::to_value(&done).unwrap();
    assert_eq!(
        done["done"],
        json!({"result": "UPGRADED", "rebootRequired": false, "relaunched": true})
    );
    assert!(done.get("waiting").is_none() && done.get("failed").is_none());

    let failed = serde_json::to_value(&failed).unwrap();
    assert_eq!(
        failed["failed"],
        json!({"reason": "MANAGER_ERROR", "exitCode": 0x8A15_0068u32, "message": "Installer failed"})
    );
    assert!(failed.get("waiting").is_none() && failed.get("done").is_none());
}
