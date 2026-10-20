use super::*;
use crate::models::{PackageRef, UpdatePolicy};
use std::time::Duration;
use tokio::time::timeout;

const BOUND: Duration = Duration::from_secs(5);

fn entry(id: &str) -> PolicyEntry {
    PolicyEntry {
        package: PackageRef::Winget { id: id.to_string() },
        policy: UpdatePolicy::default(),
    }
}

fn store_in(dir: &tempfile::TempDir) -> PolicyStore {
    PolicyStore::load(dir.path().join("package_policy.json"))
}

#[test]
fn a_missing_file_is_an_empty_policy() {
    let dir = tempfile::tempdir().unwrap();
    let store = store_in(&dir);

    assert!(store.entries().is_empty());
    assert_eq!(store.applied_sequence("m-1"), 0);
}

#[test]
fn an_unreadable_file_is_an_empty_policy() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("package_policy.json"), b"{ not json").unwrap();

    assert!(store_in(&dir).entries().is_empty());
}

#[test]
fn an_applied_policy_survives_a_reload() {
    let dir = tempfile::tempdir().unwrap();
    store_in(&dir)
        .apply("m-1", 4, vec![entry("Vendor.App")])
        .unwrap();

    let reloaded = store_in(&dir);

    assert_eq!(reloaded.entries(), vec![entry("Vendor.App")]);
    assert_eq!(reloaded.applied_sequence("m-1"), 4);
}

#[test]
fn a_policy_applied_for_another_machine_starts_the_sequence_over() {
    let dir = tempfile::tempdir().unwrap();
    let store = store_in(&dir);
    store
        .apply("old-machine", 9, vec![entry("Vendor.App")])
        .unwrap();

    assert_eq!(store.applied_sequence("new-machine"), 0);
}

#[tokio::test]
async fn a_changed_set_wakes_a_reader_even_if_it_was_not_waiting_yet() {
    let dir = tempfile::tempdir().unwrap();
    let store = store_in(&dir);

    store.apply("m-1", 1, vec![entry("Vendor.App")]).unwrap();

    timeout(BOUND, store.changed())
        .await
        .expect("the change was lost");
}

#[tokio::test]
async fn re_delivering_the_same_set_does_not_wake_readers() {
    let dir = tempfile::tempdir().unwrap();
    let store = store_in(&dir);
    store.apply("m-1", 1, vec![entry("Vendor.App")]).unwrap();
    store.changed().await;

    store.apply("m-1", 2, vec![entry("Vendor.App")]).unwrap();

    assert!(timeout(Duration::from_millis(50), store.changed())
        .await
        .is_err());
    assert_eq!(store.applied_sequence("m-1"), 2);
}

#[test]
fn the_persisted_state_round_trips() {
    let state = PackagePolicyState {
        machine_id: "m-1".to_string(),
        sequence: 7,
        packages: vec![PolicyEntry {
            package: PackageRef::Winget {
                id: "Vendor.App".to_string(),
            },
            policy: UpdatePolicy {
                force_after_seconds: Some(60),
            },
        }],
    };

    let bytes = serde_json::to_vec(&state).unwrap();

    assert_eq!(
        serde_json::from_slice::<PackagePolicyState>(&bytes).unwrap(),
        state
    );
}
