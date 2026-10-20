use super::*;
use crate::models::{PackageRef, PolicyEntry, UpdatePolicy};
use serde_json::json;
use tempfile::TempDir;

const MACHINE: &str = "machine-1";

fn handler() -> (PackagePolicyHandler, Arc<PolicyStore>, TempDir) {
    let dir = tempfile::tempdir().unwrap();
    let store = Arc::new(PolicyStore::load(dir.path().join("package_policy.json")));
    (PackagePolicyHandler::new(store.clone()), store, dir)
}

fn delivery(sequence: Option<i64>) -> DeliveryRef {
    DeliveryRef {
        delivery_type: "PACKAGE_POLICY".to_string(),
        target_id: "tenant".to_string(),
        dispatch_id: "dispatch".to_string(),
        sequence,
    }
}

fn policy(ids: &[&str]) -> PackagePolicyMessage {
    let packages: Vec<_> = ids
        .iter()
        .map(|id| json!({ "package": { "manager": "WINGET", "id": id } }))
        .collect();
    serde_json::from_value(json!({ "packages": packages })).unwrap()
}

fn entries(ids: &[&str]) -> Vec<PolicyEntry> {
    ids.iter()
        .map(|id| PolicyEntry {
            package: PackageRef::Winget { id: id.to_string() },
            policy: UpdatePolicy::default(),
        })
        .collect()
}

#[test]
fn the_subject_is_machine_scoped() {
    assert_eq!(
        PackagePolicyHandler::subject("abc123"),
        "machine.abc123.package-policy"
    );
}

#[tokio::test]
async fn a_newer_policy_is_stored() {
    let (handler, store, _dir) = handler();

    let outcome = handler
        .run(MACHINE, &delivery(Some(1)), policy(&["Vendor.App"]))
        .await;

    assert_eq!(outcome, Outcome::Done);
    assert_eq!(store.entries(), entries(&["Vendor.App"]));
}

#[tokio::test]
async fn a_stale_or_repeated_policy_is_done_without_applying() {
    let (handler, store, _dir) = handler();
    handler
        .run(MACHINE, &delivery(Some(5)), policy(&["Current.App"]))
        .await;

    for sequence in [4, 5] {
        let outcome = handler
            .run(MACHINE, &delivery(Some(sequence)), policy(&["Stale.App"]))
            .await;
        assert_eq!(outcome, Outcome::Done, "sequence {sequence}");
    }

    assert_eq!(store.entries(), entries(&["Current.App"]));
}

#[tokio::test]
async fn a_policy_without_a_sequence_fails() {
    let (handler, store, _dir) = handler();

    let outcome = handler
        .run(MACHINE, &delivery(None), policy(&["Vendor.App"]))
        .await;

    assert!(matches!(outcome, Outcome::Failed(_)));
    assert!(store.entries().is_empty());
}

#[tokio::test]
async fn an_empty_policy_turns_auto_update_off() {
    let (handler, store, _dir) = handler();
    handler
        .run(MACHINE, &delivery(Some(1)), policy(&["Vendor.App"]))
        .await;

    handler.run(MACHINE, &delivery(Some(2)), policy(&[])).await;

    assert!(store.entries().is_empty());
}
