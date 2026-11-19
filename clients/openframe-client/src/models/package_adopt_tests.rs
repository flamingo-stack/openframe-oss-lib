use super::*;
use crate::models::BrewKind;
use serde_json::json;

#[test]
fn an_order_from_an_older_backend_parses_without_the_bundle_id() {
    let order: PackageAdoptMessage = serde_json::from_value(json!({
        "delivery": {"type": "PACKAGE_ADOPT", "targetId": "req-1", "dispatchId": "d-1", "sequence": 7},
        "requestId": "req-1",
        "package": {"manager": "BREW", "kind": "CASK", "name": "firefox"}
    }))
    .unwrap();

    assert_eq!(
        order,
        PackageAdoptMessage {
            request_id: "req-1".to_string(),
            package: PackageRef::Brew {
                kind: BrewKind::Cask,
                name: "firefox".to_string(),
            },
            bundle_id: None,
        }
    );
}

#[test]
fn the_bundle_id_parses() {
    let order: PackageAdoptMessage = serde_json::from_value(json!({
        "requestId": "req-2",
        "package": {"manager": "BREW", "kind": "CASK", "name": "firefox"},
        "bundleId": "org.mozilla.firefox"
    }))
    .unwrap();

    assert_eq!(order.bundle_id.as_deref(), Some("org.mozilla.firefox"));
}

#[test]
fn an_order_without_a_package_is_rejected() {
    let result = serde_json::from_value::<PackageAdoptMessage>(json!({
        "requestId": "req-3",
        "bundleId": "org.mozilla.firefox"
    }));

    assert!(result.is_err());
}

#[test]
fn an_order_without_a_request_id_is_rejected() {
    let result = serde_json::from_value::<PackageAdoptMessage>(json!({
        "package": {"manager": "BREW", "kind": "CASK", "name": "firefox"}
    }));

    assert!(result.is_err());
}
