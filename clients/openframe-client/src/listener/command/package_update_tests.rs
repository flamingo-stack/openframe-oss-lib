use super::*;
use crate::models::{
    DeliveryResult, DeliveryResultMessage, FailReason, PackageUpdateStatusMessage, UpdateStatus,
};
use crate::services::package_manager::package_update::Ending;
use serde_json::json;
use std::sync::Mutex;
use tempfile::TempDir;

const MACHINE: &str = "machine-1";

struct Fixture {
    handler: PackageUpdateHandler,
    orders: Arc<OrderStore>,
    events: Arc<Mutex<Vec<PackageUpdateStatusMessage>>>,
    results: Arc<Mutex<Vec<DeliveryResultMessage>>>,
    _dir: TempDir,
}

fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let orders = Arc::new(OrderStore::load(dir.path().join("package_updates.json")));
    let (status, events) = StatusReporter::in_memory();
    let (results, settled) = DeliveryResults::in_memory();
    Fixture {
        handler: PackageUpdateHandler::new(orders.clone(), status, results),
        orders,
        events,
        results: settled,
        _dir: dir,
    }
}

fn delivery(sequence: Option<i64>) -> DeliveryRef {
    DeliveryRef {
        delivery_type: "PACKAGE_UPDATE".to_string(),
        target_id: "req-1".to_string(),
        dispatch_id: "dispatch".to_string(),
        sequence,
    }
}

fn supported_package() -> serde_json::Value {
    if cfg!(target_os = "windows") {
        json!({"manager": "WINGET", "id": "Vendor.App"})
    } else {
        json!({"manager": "BREW", "kind": "CASK", "name": "vendor-app"})
    }
}

fn order(
    request_id: &str,
    mode: &str,
    countdown: Option<u64>,
    origin: &str,
) -> PackageUpdateMessage {
    serde_json::from_value(json!({
        "requestId": request_id,
        "source": {"kind": "MANUAL", "origin": origin},
        "package": supported_package(),
        "mode": mode,
        "countdownSeconds": countdown,
    }))
    .unwrap()
}

#[test]
fn the_subject_is_machine_scoped() {
    assert_eq!(
        PackageUpdateHandler::subject("abc123"),
        "machine.abc123.package-update"
    );
}

#[tokio::test]
async fn an_order_is_stored_and_answered_once_it_ends() {
    let f = fixture();

    let outcome = f
        .handler
        .run(
            MACHINE,
            &delivery(Some(1)),
            order("req-1", "WAIT", None, "ADMIN"),
            (),
        )
        .await;

    assert_eq!(outcome, Outcome::Deferred);
    let pending = f.orders.pending(MACHINE);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].mode, UpdateMode::Wait);
    assert_eq!(pending[0].deliveries, vec![delivery(Some(1))]);
    assert!(f.events.lock().unwrap().is_empty(), "nothing to report yet");
    assert!(
        f.results.lock().unwrap().is_empty(),
        "nothing to answer yet"
    );
}

/// The one event a refused order leaves: FAILED with `reason`, for `request_id`.
fn assert_refused(f: &Fixture, outcome: Outcome, request_id: &str, reason: FailReason) {
    assert_eq!(outcome, Outcome::Done, "the refusal itself is the outcome");
    assert!(f.orders.pending(MACHINE).is_empty());
    let events = f.events.lock().unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].request_id, request_id);
    assert_eq!(events[0].state, UpdateStatus::Failed);
    assert_eq!(
        events[0].failed.as_ref().map(|failed| failed.reason),
        Some(reason)
    );
}

#[tokio::test]
async fn an_order_without_a_sequence_fails() {
    let f = fixture();

    let outcome = f
        .handler
        .run(
            MACHINE,
            &delivery(None),
            order("req-1", "WAIT", None, "ADMIN"),
            (),
        )
        .await;

    assert!(matches!(outcome, Outcome::Failed(_)));
    assert!(f.orders.pending(MACHINE).is_empty());
}

#[tokio::test]
async fn an_unsupported_manager_is_refused_on_the_status_stream() {
    let f = fixture();
    let command: PackageUpdateMessage = serde_json::from_value(json!({
        "requestId": "req-1",
        "source": {"kind": "AUTO"},
        "package": {"manager": "CHOCO", "id": "git"},
        "mode": "WAIT",
    }))
    .unwrap();

    let outcome = f
        .handler
        .run(MACHINE, &delivery(Some(1)), command, ())
        .await;

    assert_refused(&f, outcome, "req-1", FailReason::NotSupported);
}

#[tokio::test]
async fn an_older_sequence_for_a_pending_order_waits_with_it_unchanged() {
    let f = fixture();
    f.handler
        .run(
            MACHINE,
            &delivery(Some(5)),
            order("req-1", "WAIT", None, "ADMIN"),
            (),
        )
        .await;

    let outcome = f
        .handler
        .run(
            MACHINE,
            &delivery(Some(4)),
            order("req-1", "FORCE", Some(60), "ADMIN"),
            (),
        )
        .await;

    assert_eq!(outcome, Outcome::Deferred);
    assert_eq!(f.orders.pending(MACHINE)[0].mode, UpdateMode::Wait);
    assert!(f.results.lock().unwrap().is_empty());
}

#[tokio::test]
async fn a_re_send_of_a_request_that_ended_done_is_done_at_once() {
    let f = fixture();
    f.handler
        .run(
            MACHINE,
            &delivery(Some(5)),
            order("req-1", "WAIT", None, "ADMIN"),
            (),
        )
        .await;
    f.orders.finish("req-1", &Ending::Done);

    let outcome = f
        .handler
        .run(
            MACHINE,
            &delivery(Some(5)),
            order("req-1", "WAIT", None, "ADMIN"),
            (),
        )
        .await;

    assert_eq!(outcome, Outcome::Done);
    assert!(f.orders.pending(MACHINE).is_empty());
}

#[tokio::test]
async fn a_superseded_order_is_reported_as_failed() {
    let f = fixture();
    f.handler
        .run(
            MACHINE,
            &delivery(Some(1)),
            order("req-1", "WAIT", None, "ADMIN"),
            (),
        )
        .await;

    let outcome = f
        .handler
        .run(
            MACHINE,
            &delivery(Some(1)),
            order("req-2", "WAIT", None, "ADMIN"),
            (),
        )
        .await;

    assert_eq!(outcome, Outcome::Deferred);
    let results = f.results.lock().unwrap();
    assert_eq!(results.len(), 1, "the old request's dispatch is answered");
    assert_eq!(results[0].delivery, delivery(Some(1)));
    assert_eq!(results[0].result, DeliveryResult::Done);
    let events = f.events.lock().unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].request_id, "req-1");
    assert_eq!(events[0].state, UpdateStatus::Failed);
    assert_eq!(
        events[0].failed.as_ref().map(|failed| failed.reason),
        Some(FailReason::Superseded)
    );
    assert_eq!(f.orders.pending(MACHINE)[0].request_id, "req-2");
}

#[tokio::test]
async fn every_dispatch_of_a_superseded_order_is_answered_done() {
    let f = fixture();
    for (sequence, dispatch_id) in [(1, "wait"), (2, "now"), (1, "rerun")] {
        let mut ref_ = delivery(Some(sequence));
        ref_.dispatch_id = dispatch_id.to_string();
        let mode = if dispatch_id == "now" {
            "FORCE"
        } else {
            "WAIT"
        };
        f.handler
            .run(MACHINE, &ref_, order("req-1", mode, Some(60), "ADMIN"), ())
            .await;
    }
    let mut newer = delivery(Some(3));
    newer.dispatch_id = "newer".to_string();

    let outcome = f
        .handler
        .run(MACHINE, &newer, order("req-2", "WAIT", None, "ADMIN"), ())
        .await;

    assert_eq!(outcome, Outcome::Deferred);
    let answered: Vec<(String, DeliveryResult)> = f
        .results
        .lock()
        .unwrap()
        .iter()
        .map(|message| (message.delivery.dispatch_id.clone(), message.result))
        .collect();
    assert_eq!(
        answered,
        [
            ("wait".to_string(), DeliveryResult::Done),
            ("now".to_string(), DeliveryResult::Done),
            ("rerun".to_string(), DeliveryResult::Done),
        ]
    );
    assert_eq!(f.orders.pending(MACHINE)[0].deliveries, vec![newer]);
}

#[tokio::test]
async fn an_unsupported_order_owes_no_later_answer() {
    let f = fixture();
    let command: PackageUpdateMessage = serde_json::from_value(json!({
        "requestId": "req-1",
        "source": {"kind": "AUTO"},
        "package": {"manager": "CHOCO", "id": "git"},
        "mode": "WAIT",
    }))
    .unwrap();

    f.handler
        .run(MACHINE, &delivery(Some(1)), command, ())
        .await;

    assert!(f.orders.get("req-1").is_none());
    assert!(f.results.lock().unwrap().is_empty());
}

#[cfg(unix)]
#[tokio::test]
async fn an_order_that_cannot_be_stored_fails_at_once_and_owes_nothing() {
    use std::os::unix::fs::PermissionsExt;

    let f = fixture();
    std::fs::set_permissions(f._dir.path(), std::fs::Permissions::from_mode(0o500)).unwrap();

    let outcome = f
        .handler
        .run(
            MACHINE,
            &delivery(Some(1)),
            order("req-1", "WAIT", None, "ADMIN"),
            (),
        )
        .await;

    std::fs::set_permissions(f._dir.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    assert!(matches!(outcome, Outcome::Failed(_)), "{outcome:?}");
    assert!(f.orders.pending(MACHINE).is_empty());
    assert!(f.results.lock().unwrap().is_empty());
}

#[tokio::test]
async fn without_the_ledger_a_repeat_of_a_failed_dispatch_fails_again_and_runs_nothing() {
    let f = fixture();
    f.handler
        .run(
            MACHINE,
            &delivery(Some(4)),
            order("req-1", "WAIT", None, "ADMIN"),
            (),
        )
        .await;
    f.orders.finish(
        "req-1",
        &Ending::Retry {
            reason: FailReason::ManagerError,
            message: "boom".to_string(),
        },
    );

    let repeat = f
        .handler
        .run(
            MACHINE,
            &delivery(Some(4)),
            order("req-1", "WAIT", None, "ADMIN"),
            (),
        )
        .await;
    let mut rerun = delivery(Some(4));
    rerun.dispatch_id = "rerun".to_string();
    let rerun_outcome = f
        .handler
        .run(MACHINE, &rerun, order("req-1", "WAIT", None, "ADMIN"), ())
        .await;

    assert!(matches!(repeat, Outcome::Failed(_)), "{repeat:?}");
    assert_eq!(rerun_outcome, Outcome::Deferred);
    assert_eq!(f.orders.pending(MACHINE)[0].deliveries, vec![rerun]);
}

#[tokio::test]
async fn the_dispatches_owed_are_those_of_the_pending_orders_of_this_machine() {
    let f = fixture();
    for (dispatch_id, request_id) in [("a1", "req-a"), ("a2", "req-a")] {
        let mut ref_ = delivery(Some(if dispatch_id == "a1" { 1 } else { 2 }));
        ref_.dispatch_id = dispatch_id.to_string();
        f.handler
            .run(MACHINE, &ref_, order(request_id, "WAIT", None, "ADMIN"), ())
            .await;
    }
    assert_eq!(PackageUpdateHandler::DEFERRED_TYPE, Some("PACKAGE_UPDATE"));

    let owed = f.handler.owed_deliveries(MACHINE);

    assert_eq!(
        owed,
        ["a1".to_string(), "a2".to_string()].into_iter().collect()
    );
    assert!(f.handler.owed_deliveries("another-machine").is_empty());
    f.orders.finish("req-a", &Ending::Done);
    assert!(f.handler.owed_deliveries(MACHINE).is_empty());
}

#[test]
fn the_countdown_follows_the_contract_range() {
    assert_eq!(countdown_for(&order("r", "WAIT", Some(900), "ADMIN")), 0);
    assert_eq!(countdown_for(&order("r", "FORCE", None, "ADMIN")), 300);
    assert_eq!(countdown_for(&order("r", "FORCE", Some(900), "ADMIN")), 900);
    assert_eq!(countdown_for(&order("r", "FORCE", Some(5), "ADMIN")), 60);
    assert_eq!(
        countdown_for(&order("r", "FORCE", Some(7200), "ADMIN")),
        1800
    );
    assert_eq!(countdown_for(&order("r", "FORCE", Some(0), "ADMIN")), 60);
    assert_eq!(countdown_for(&order("r", "FORCE", Some(0), "USER")), 0);
}
