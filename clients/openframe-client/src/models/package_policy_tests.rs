use super::*;
use crate::models::BrewKind;
use serde_json::json;

#[test]
fn a_delivered_policy_parses_with_and_without_a_force_policy() {
    let message: PackagePolicyMessage = serde_json::from_value(json!({
        "delivery": { "type": "PACKAGE_POLICY", "targetId": "t", "dispatchId": "d", "sequence": 3 },
        "packages": [
            { "package": { "manager": "WINGET", "id": "Notepad++.Notepad++" } },
            { "package": { "manager": "BREW", "kind": "CASK", "name": "postman" },
              "policy": { "forceAfterSeconds": 432000 } }
        ]
    }))
    .unwrap();

    assert_eq!(
        message.packages,
        vec![
            PolicyEntry {
                package: PackageRef::Winget {
                    id: "Notepad++.Notepad++".to_string()
                },
                policy: UpdatePolicy::default(),
            },
            PolicyEntry {
                package: PackageRef::Brew {
                    kind: BrewKind::Cask,
                    name: "postman".to_string()
                },
                policy: UpdatePolicy {
                    force_after_seconds: Some(432_000)
                },
            },
        ]
    );
}

#[test]
fn unknown_policy_fields_are_ignored() {
    let entry: PolicyEntry = serde_json::from_value(json!({
        "package": { "manager": "CHOCO", "id": "git" },
        "policy": { "maintenanceWindow": "nights" }
    }))
    .unwrap();

    assert_eq!(entry.policy, UpdatePolicy::default());
}
