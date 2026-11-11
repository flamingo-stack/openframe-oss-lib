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

fn retry() -> Ending {
    Ending::Retry {
        reason: FailReason::ManagerError,
        message: "boom".to_string(),
    }
}

fn dispatch(sequence: i64) -> DeliveryRef {
    DeliveryRef {
        delivery_type: "PACKAGE_UPDATE".to_string(),
        target_id: "req".to_string(),
        dispatch_id: format!("dispatch-{sequence}"),
        sequence: Some(sequence),
    }
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
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
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
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    let mut force = wait("req-1", "Vendor.App");
    force.mode = UpdateMode::Force;
    let submitted = store.submit(MACHINE, dispatch(2), 200, force, 300).unwrap();

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
fn an_older_sequence_attaches_to_a_pending_request_and_is_stale_once_it_ended_done() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(5), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    for sequence in [4, 5] {
        assert_eq!(
            store
                .submit(
                    MACHINE,
                    dispatch(sequence),
                    200,
                    wait("req-1", "Vendor.App"),
                    0
                )
                .unwrap(),
            Submitted::Attached,
            "sequence {sequence}"
        );
    }
    assert_eq!(store.pending(MACHINE)[0].revision, 0);

    store.finish("req-1", &Ending::Done);
    assert!(store.pending(MACHINE).is_empty());
    assert_eq!(
        store
            .submit(MACHINE, dispatch(5), 300, wait("req-1", "Vendor.App"), 0)
            .unwrap(),
        Submitted::Stale
    );
    assert_eq!(
        store
            .submit(MACHINE, dispatch(6), 300, wait("req-1", "Vendor.App"), 0)
            .unwrap(),
        Submitted::Accepted
    );
}

#[test]
fn finishing_remembers_the_sequence_current_at_that_time() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    store
        .submit(MACHINE, dispatch(3), 200, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    store.finish("req-1", &Ending::Done);

    assert_eq!(
        store
            .submit(MACHINE, dispatch(3), 300, wait("req-1", "Vendor.App"), 0)
            .unwrap(),
        Submitted::Stale
    );
}

#[test]
fn a_different_request_for_the_same_package_supersedes_the_pending_one() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    let submitted = store
        .submit(MACHINE, dispatch(1), 200, wait("req-2", "Vendor.App"), 0)
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
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    assert!(store.start_installing("req-1"));

    let submitted = store
        .submit(MACHINE, dispatch(1), 200, wait("req-2", "Vendor.App"), 0)
        .unwrap();

    assert_eq!(submitted, Submitted::Accepted);
    let ids: Vec<String> = store
        .pending(MACHINE)
        .into_iter()
        .map(|o| o.request_id)
        .collect();
    assert_eq!(ids, vec!["req-1", "req-2"]);

    store.finish("req-1", &Ending::Done);
    assert_eq!(store.pending(MACHINE).len(), 1);
    let third = store
        .submit(MACHINE, dispatch(1), 300, wait("req-3", "Vendor.App"), 0)
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
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    store
        .submit(MACHINE, dispatch(1), 200, wait("req-2", "Vendor.App"), 0)
        .unwrap();

    assert!(!store.start_installing("req-1"));
    assert!(store.start_installing("req-2"));
    let third = store
        .submit(MACHINE, dispatch(1), 300, wait("req-3", "Vendor.App"), 0)
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
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    let submitted = store
        .submit(MACHINE, dispatch(1), 200, wait("req-2", "vendor.app"), 0)
        .unwrap();

    assert!(matches!(submitted, Submitted::Superseded(_)));
    assert_eq!(store.pending(MACHINE).len(), 1);
}

#[test]
fn manual_orders_come_before_automatic_ones_then_oldest_first() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(1), 300, wait("auto-late", "A.App"), 0)
        .unwrap();
    store
        .submit(MACHINE, dispatch(1), 100, wait("auto-early", "B.App"), 0)
        .unwrap();
    store
        .submit(
            MACHINE,
            dispatch(1),
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
        .submit(MACHINE, dispatch(7), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    assert!(
        store.pending("machine-2").is_empty(),
        "another id sees nothing"
    );

    store
        .submit("machine-2", dispatch(1), 200, wait("req-9", "Other.App"), 0)
        .unwrap();

    let pending = store.pending("machine-2");
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].request_id, "req-9");
    assert!(store.pending(MACHINE).is_empty());
    assert_eq!(
        store
            .submit(
                "machine-2",
                dispatch(1),
                300,
                wait("req-1", "Vendor.App"),
                0
            )
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
            .submit(MACHINE, dispatch(1), i as u64, wait(&id, "Vendor.App"), 0)
            .unwrap();
        store.finish(&id, &Ending::Done);
    }

    assert_eq!(store.state().finished.len(), FINISHED_MEMORY);
    assert_eq!(
        store
            .submit(MACHINE, dispatch(1), 1, wait("req-0", "Vendor.App"), 0)
            .unwrap(),
        Submitted::Accepted,
        "the oldest finished request is forgotten"
    );
}

#[test]
fn every_dispatch_of_a_request_is_handed_back_once_when_it_finishes() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    let mut force = wait("req-1", "Vendor.App");
    force.mode = UpdateMode::Force;
    store.submit(MACHINE, dispatch(2), 200, force, 300).unwrap();
    let repeat = store
        .submit(MACHINE, dispatch(1), 300, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    let mut rerun = dispatch(1);
    rerun.dispatch_id = "rerun".to_string();
    let rerun_submitted = store
        .submit(MACHINE, rerun.clone(), 400, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    assert_eq!(repeat, Submitted::Attached);
    assert_eq!(rerun_submitted, Submitted::Attached);
    let pending = store.pending(MACHINE);
    assert_eq!(
        pending[0].mode,
        UpdateMode::Force,
        "an older sequence keeps the mode"
    );
    assert_eq!(pending[0].countdown_seconds, 300);
    assert_eq!(
        pending[0].revision, 1,
        "only the newer sequence counts as a change"
    );
    let deliveries = store.finish("req-1", &Ending::Done);
    assert_eq!(deliveries, vec![dispatch(1), dispatch(2), rerun]);
    assert_eq!(store.finish("req-1", &Ending::Done), Vec::new());
}

#[test]
fn a_request_that_ended_in_a_retryable_failure_runs_again_on_the_same_sequence() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(5), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    store.finish("req-1", &retry());

    let mut rerun = dispatch(5);
    rerun.dispatch_id = "rerun".to_string();
    assert_eq!(
        store
            .submit(MACHINE, rerun.clone(), 200, wait("req-1", "Vendor.App"), 0)
            .unwrap(),
        Submitted::Accepted
    );
    assert_eq!(store.pending(MACHINE)[0].deliveries, vec![rerun]);
    assert_eq!(
        store
            .submit(MACHINE, dispatch(5), 300, wait("req-1", "Vendor.App"), 0)
            .unwrap(),
        Submitted::AlreadyFailed,
        "a repeat of the failed dispatch does not run the order again"
    );
}

#[test]
fn a_superseded_order_carries_the_dispatches_it_owes() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    let submitted = store
        .submit(MACHINE, dispatch(2), 200, wait("req-2", "Vendor.App"), 0)
        .unwrap();

    let Submitted::Superseded(old) = submitted else {
        panic!("expected the pending order to be superseded, got {submitted:?}");
    };
    assert_eq!(old.request_id, "req-1");
    assert_eq!(old.deliveries, vec![dispatch(1)]);
}

#[test]
fn orders_written_before_dispatches_were_kept_still_load() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("package_updates.json");
    std::fs::write(
        &path,
        serde_json::to_vec(&serde_json::json!({
            "machine_id": MACHINE,
            "pending": [{
                "request_id": "req-1",
                "sequence": 3,
                "source": {"kind": "AUTO"},
                "package": {"manager": "WINGET", "id": "Vendor.App"},
                "mode": "WAIT",
                "countdown_seconds": 0,
                "received_at": 100,
                "revision": 2,
            }],
            "finished": [{"request_id": "req-0", "sequence": 1}],
        }))
        .unwrap(),
    )
    .unwrap();

    let store = OrderStore::load(path);

    let pending = store.pending(MACHINE);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].revision, 2);
    assert!(pending[0].deliveries.is_empty());
    assert_eq!(
        store
            .submit(MACHINE, dispatch(1), 200, wait("req-0", "Other.App"), 0)
            .unwrap(),
        Submitted::Stale
    );
}

fn force(request_id: &str, package: &str) -> PackageUpdateMessage {
    let mut message = wait(request_id, package);
    message.mode = UpdateMode::Force;
    message
}

fn rerun(sequence: i64, dispatch_id: &str) -> DeliveryRef {
    DeliveryRef {
        dispatch_id: dispatch_id.to_string(),
        ..dispatch(sequence)
    }
}

#[test]
fn a_deadline_force_arriving_before_an_older_wait_rerun_keeps_its_mode() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(10), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    store
        .submit(
            MACHINE,
            dispatch(15),
            200,
            force("req-1", "Vendor.App"),
            120,
        )
        .unwrap();

    let submitted = store
        .submit(
            MACHINE,
            rerun(10, "wait-rerun"),
            300,
            wait("req-1", "Vendor.App"),
            0,
        )
        .unwrap();

    assert_eq!(submitted, Submitted::Attached);
    let order = store.get("req-1").unwrap();
    assert_eq!(order.mode, UpdateMode::Force);
    assert_eq!(order.countdown_seconds, 120);
    assert_eq!(order.sequence, 15);
    assert_eq!(order.revision, 1);
    assert_eq!(
        order.deliveries,
        vec![dispatch(10), dispatch(15), rerun(10, "wait-rerun")]
    );
}

#[test]
fn a_restart_keeps_every_pending_dispatch_and_still_dedups_repeats() {
    let (store, dir) = store();
    store
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    store
        .submit(MACHINE, dispatch(2), 200, force("req-1", "Vendor.App"), 60)
        .unwrap();

    let reloaded = OrderStore::load(dir.path().join("package_updates.json"));

    assert_eq!(reloaded.pending(MACHINE), store.pending(MACHINE));
    assert_eq!(
        reloaded
            .submit(MACHINE, dispatch(2), 300, force("req-1", "Vendor.App"), 60)
            .unwrap(),
        Submitted::Attached
    );
    let order = reloaded.get("req-1").unwrap();
    assert_eq!(order.deliveries, vec![dispatch(1), dispatch(2)]);
    assert_eq!(
        order.revision, 1,
        "a repeat after the restart changes nothing"
    );
}

#[test]
fn an_order_queued_behind_a_running_install_keeps_its_own_dispatches() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    assert!(store.start_installing("req-1"));
    store
        .submit(MACHINE, dispatch(2), 200, wait("req-2", "Vendor.App"), 0)
        .unwrap();
    store
        .submit(
            MACHINE,
            rerun(1, "first-rerun"),
            300,
            wait("req-1", "Vendor.App"),
            0,
        )
        .unwrap();

    let first = store.finish("req-1", &Ending::Done);

    assert_eq!(first, vec![dispatch(1), rerun(1, "first-rerun")]);
    let pending = store.pending(MACHINE);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].deliveries, vec![dispatch(2)]);
}

#[test]
fn a_retryable_failure_after_a_newer_order_forgets_the_earlier_done() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(3), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    store.finish("req-1", &Ending::Done);
    store
        .submit(MACHINE, dispatch(4), 200, force("req-1", "Vendor.App"), 60)
        .unwrap();

    store.finish("req-1", &retry());

    assert_eq!(
        store
            .submit(
                MACHINE,
                rerun(4, "rerun"),
                300,
                force("req-1", "Vendor.App"),
                60
            )
            .unwrap(),
        Submitted::Accepted
    );
}

#[test]
fn a_finish_of_an_unknown_request_owes_nothing() {
    let (store, _dir) = store();

    assert!(store.finish("nobody", &retry()).is_empty());
}

#[test]
fn a_new_machine_id_drops_the_orders_and_their_dispatches() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    store
        .submit("machine-2", dispatch(1), 200, wait("req-2", "Other.App"), 0)
        .unwrap();

    assert_eq!(store.finish("req-1", &Ending::Done), Vec::new());
}

#[cfg(unix)]
#[test]
fn a_finish_that_cannot_be_persisted_still_leaves_the_pending_list() {
    use std::os::unix::fs::PermissionsExt;

    let (store, dir) = store();
    store
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();
    std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o500)).unwrap();

    let deliveries = store.finish("req-1", &Ending::Done);

    std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(deliveries, vec![dispatch(1)], "the answers are still owed");
    assert!(
        store.pending(MACHINE).is_empty(),
        "the order does not run again"
    );
}

#[tokio::test]
async fn a_change_wakes_a_waiter_even_when_it_arrives_first() {
    let (store, _dir) = store();
    store
        .submit(MACHINE, dispatch(1), 100, wait("req-1", "Vendor.App"), 0)
        .unwrap();

    tokio::time::timeout(std::time::Duration::from_secs(1), store.changed())
        .await
        .expect("the submit before the wait was lost");
}
