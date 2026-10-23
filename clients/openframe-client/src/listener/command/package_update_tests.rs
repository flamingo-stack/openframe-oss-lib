use super::*;
use crate::models::{FailReason, PackageUpdateStatusMessage, UpdateStatus};
use serde_json::json;
use std::sync::Mutex;
use tempfile::TempDir;

const MACHINE: &str = "machine-1";

struct Fixture {
    handler: PackageUpdateHandler,
    orders: Arc<OrderStore>,
    events: Arc<Mutex<Vec<PackageUpdateStatusMessage>>>,
    _dir: TempDir,
}

fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let orders = Arc::new(OrderStore::load(dir.path().join("package_updates.json")));
    let (status, events) = StatusReporter::in_memory();
    Fixture {
        handler: PackageUpdateHandler::new(orders.clone(), status),
        orders,
        events,
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
async fn an_order_is_stored_and_done_at_once() {
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

    assert_eq!(outcome, Outcome::Done);
    let pending = f.orders.pending(MACHINE);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].mode, UpdateMode::Wait);
    assert!(f.events.lock().unwrap().is_empty(), "nothing to report yet");
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
async fn an_unsupported_manager_is_refused_and_dropped() {
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

    assert!(matches!(outcome, Outcome::Failed(_)));
    assert!(f.orders.pending(MACHINE).is_empty());
}

#[tokio::test]
async fn a_stale_sequence_is_done_without_changing_the_order() {
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

    assert_eq!(outcome, Outcome::Done);
    assert_eq!(f.orders.pending(MACHINE)[0].mode, UpdateMode::Wait);
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

    assert_eq!(outcome, Outcome::Done);
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
