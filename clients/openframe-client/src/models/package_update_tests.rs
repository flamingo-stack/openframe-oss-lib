use super::*;
use crate::models::BrewKind;
use serde_json::json;

#[test]
fn the_contract_order_parses() {
    let order: PackageUpdateMessage = serde_json::from_value(json!({
        "delivery": {"type": "PACKAGE_UPDATE", "targetId": "req-1", "dispatchId": "d-1", "sequence": 43},
        "requestId": "req-1",
        "source": {"kind": "MANUAL", "origin": "ADMIN"},
        "package": {"manager": "WINGET", "id": "Google.Chrome"},
        "mode": "FORCE",
        "countdownSeconds": 300
    }))
    .unwrap();

    assert_eq!(
        order,
        PackageUpdateMessage {
            request_id: "req-1".to_string(),
            source: UpdateSource {
                kind: SourceKind::Manual,
                origin: Some(SourceOrigin::Admin),
            },
            package: PackageRef::Winget {
                id: "Google.Chrome".to_string()
            },
            mode: UpdateMode::Force,
            countdown_seconds: Some(300),
        }
    );
}

#[test]
fn an_auto_wait_order_needs_neither_origin_nor_countdown() {
    let order: PackageUpdateMessage = serde_json::from_value(json!({
        "requestId": "req-2",
        "source": {"kind": "AUTO"},
        "package": {"manager": "BREW", "kind": "CASK", "name": "postman"},
        "mode": "WAIT"
    }))
    .unwrap();

    assert_eq!(order.source.origin, None);
    assert!(!order.source.is_user());
    assert_eq!(order.countdown_seconds, None);
    assert_eq!(
        order.package,
        PackageRef::Brew {
            kind: BrewKind::Cask,
            name: "postman".to_string()
        }
    );
}

#[test]
fn an_unknown_mode_is_rejected() {
    let result = serde_json::from_value::<PackageUpdateMessage>(json!({
        "requestId": "req-3",
        "source": {"kind": "AUTO"},
        "package": {"manager": "WINGET", "id": "Vendor.App"},
        "mode": "SKIP"
    }));

    assert!(result.is_err());
}
