use super::*;
use crate::models::SourceOrigin;
use tempfile::TempDir;

const MACHINE: &str = "machine-1";

fn store() -> (OrderStore, TempDir) {
    let dir = tempfile::tempdir().unwrap();
    (
        OrderStore::load(dir.path().join("package_updates.json")),
        dir,
    )
}

fn winget(id: &str) -> PackageRef {
    PackageRef::Winget { id: id.to_string() }
}

fn order(
    request_id: &str,
    kind: SourceKind,
    package: PackageRef,
    mode: UpdateMode,
) -> PackageUpdateMessage {
    PackageUpdateMessage {
        request_id: request_id.to_string(),
        source: UpdateSource {
            kind,
            origin: (kind == SourceKind::Manual).then_some(SourceOrigin::Admin),
        },
        package,
        mode,
        countdown_seconds: None,
    }
}

fn wait(request_id: &str, package: &str) -> PackageUpdateMessage {
    order(
        request_id,
        SourceKind::Auto,
        winget(package),
        UpdateMode::Wait,
    )
}

#[test]
fn a_new_order_is_pending_and_persisted() {
    let (store, dir) = store();

    let submitted = store
        .submit(MACHINE, 1, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    assert_eq!(submitted, Submitted::Accepted);
    let pending = store.pending(MACHINE);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].request_id, "req-1");
    assert_eq!(pending[0].revision, 0);
    let reloaded = OrderStore::load(dir.path().join("package_updates.json"));
    assert_eq!(reloaded.pending(MACHINE), pending);
}

#[test]
fn a_re_send_of_the_same_request_updates_it_in_place() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, 1, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    let mut force = wait("req-1", "Vendor.App");
    force.mode = UpdateMode::Force;
    let submitted = store.submit(MACHINE, 2, 200, force, 300).unwrap();

    assert_eq!(submitted, Submitted::Accepted);
    let pending = store.pending(MACHINE);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].mode, UpdateMode::Force);
    assert_eq!(pending[0].countdown_seconds, 300);
    assert_eq!(pending[0].sequence, 2);
    assert_eq!(pending[0].revision, 1);
    assert_eq!(pending[0].received_at, 100, "the arrival order is kept");
}

#[test]
fn a_stale_sequence_is_ignored_for_pending_and_finished_requests() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, 5, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    for sequence in [4, 5] {
        assert_eq!(
            store
                .submit(MACHINE, sequence, 200, wait("req-1", "Vendor.App"), 0)
                .unwrap(),
            Submitted::Stale,
            "sequence {sequence}"
        );
    }
    assert_eq!(store.pending(MACHINE)[0].revision, 0);

    store.finish("req-1").unwrap();
    assert!(store.pending(MACHINE).is_empty());
    assert_eq!(
        store
            .submit(MACHINE, 5, 300, wait("req-1", "Vendor.App"), 0)
            .unwrap(),
        Submitted::Stale
    );
    assert_eq!(
        store
            .submit(MACHINE, 6, 300, wait("req-1", "Vendor.App"), 0)
            .unwrap(),
        Submitted::Accepted
    );
}

#[test]
fn finishing_remembers_the_sequence_current_at_that_time() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, 1, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    store
        .submit(MACHINE, 3, 200, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    store.finish("req-1").unwrap();

    assert_eq!(
        store
            .submit(MACHINE, 3, 300, wait("req-1", "Vendor.App"), 0)
            .unwrap(),
        Submitted::Stale
    );
}

#[test]
fn a_different_request_for_the_same_package_supersedes_the_pending_one() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, 1, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    let submitted = store
        .submit(MACHINE, 1, 200, wait("req-2", "Vendor.App"), 0)
        .unwrap();

    match submitted {
        Submitted::Superseded(old) => assert_eq!(old.request_id, "req-1"),
        other => panic!("expected the first order to be superseded, got {other:?}"),
    }
    let pending = store.pending(MACHINE);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].request_id, "req-2");
}

#[test]
fn an_order_whose_install_runs_is_not_superseded() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, 1, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    assert!(store.start_installing("req-1"));

    let submitted = store
        .submit(MACHINE, 1, 200, wait("req-2", "Vendor.App"), 0)
        .unwrap();

    assert_eq!(submitted, Submitted::Accepted);
    let ids: Vec<String> = store
        .pending(MACHINE)
        .into_iter()
        .map(|o| o.request_id)
        .collect();
    assert_eq!(ids, vec!["req-1", "req-2"]);

    store.finish("req-1").unwrap();
    assert_eq!(store.pending(MACHINE).len(), 1);
    let third = store
        .submit(MACHINE, 1, 300, wait("req-3", "Vendor.App"), 0)
        .unwrap();
    assert!(
        matches!(third, Submitted::Superseded(ref old) if old.request_id == "req-2"),
        "finishing clears the install mark: {third:?}"
    );
}

#[test]
fn a_superseded_order_cannot_start_its_install() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, 1, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    store
        .submit(MACHINE, 1, 200, wait("req-2", "Vendor.App"), 0)
        .unwrap();

    assert!(!store.start_installing("req-1"));
    assert!(store.start_installing("req-2"));
    let third = store
        .submit(MACHINE, 1, 300, wait("req-3", "Vendor.App"), 0)
        .unwrap();
    assert_eq!(
        third,
        Submitted::Accepted,
        "the request that started stays pending"
    );
}

#[test]
fn a_differently_cased_winget_id_is_the_same_package() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, 1, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    let submitted = store
        .submit(MACHINE, 1, 200, wait("req-2", "vendor.app"), 0)
        .unwrap();

    assert!(matches!(submitted, Submitted::Superseded(_)));
    assert_eq!(store.pending(MACHINE).len(), 1);
}

#[test]
fn manual_orders_come_before_automatic_ones_then_oldest_first() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, 1, 300, wait("auto-late", "A.App"), 0)
        .unwrap();
    store
        .submit(MACHINE, 1, 100, wait("auto-early", "B.App"), 0)
        .unwrap();
    store
        .submit(
            MACHINE,
            1,
            400,
            order(
                "manual",
                SourceKind::Manual,
                winget("C.App"),
                UpdateMode::Force,
            ),
            300,
        )
        .unwrap();

    let pending = store.pending(MACHINE);
    let ids: Vec<&str> = pending.iter().map(|o| o.request_id.as_str()).collect();

    assert_eq!(ids, vec!["manual", "auto-early", "auto-late"]);
}

#[test]
fn orders_of_another_machine_id_are_dropped_and_hidden() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, 7, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    assert!(
        store.pending("machine-2").is_empty(),
        "another id sees nothing"
    );

    store
        .submit("machine-2", 1, 200, wait("req-9", "Other.App"), 0)
        .unwrap();

    let pending = store.pending("machine-2");
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].request_id, "req-9");
    assert!(store.pending(MACHINE).is_empty());
    assert_eq!(
        store
            .submit("machine-2", 1, 300, wait("req-1", "Vendor.App"), 0)
            .unwrap(),
        Submitted::Accepted,
        "the old machine's sequences are forgotten"
    );
}

#[test]
fn finished_memory_is_capped() {
    let (store, _dir) = store();
    for i in 0..(FINISHED_MEMORY + 10) {
        let id = format!("req-{i}");
        store
            .submit(MACHINE, 1, i as u64, wait(&id, "Vendor.App"), 0)
            .unwrap();
        store.finish(&id).unwrap();
    }

    assert_eq!(store.state().finished.len(), FINISHED_MEMORY);
    assert_eq!(
        store
            .submit(MACHINE, 1, 1, wait("req-0", "Vendor.App"), 0)
            .unwrap(),
        Submitted::Accepted,
        "the oldest finished request is forgotten"
    );
}

#[cfg(unix)]
#[test]
fn a_finish_that_cannot_be_persisted_still_leaves_the_pending_list() {
    use std::os::unix::fs::PermissionsExt;

    let (store, dir) = store();
    store
        .submit(MACHINE, 1, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o500)).unwrap();

    let result = store.finish("req-1");

    std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    assert!(result.is_err(), "the persist failure is reported");
    assert!(
        store.pending(MACHINE).is_empty(),
        "the order does not run again"
    );
}

#[tokio::test]
async fn a_change_wakes_a_waiter_even_when_it_arrives_first() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, 1, 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    tokio::time::timeout(std::time::Duration::from_secs(1), store.changed())
        .await
        .expect("the submit before the wait was lost");
}
