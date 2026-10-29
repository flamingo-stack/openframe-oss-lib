use super::*;
use crate::models::DeliveryRef;

fn ledger() -> (tempfile::TempDir, DeliveryLedger) {
    let dir = tempfile::tempdir().unwrap();
    let ledger = DeliveryLedger::at(dir.path().join("updater_deliveries.json"));
    (dir, ledger)
}

fn delivery(dispatch_id: &str, sequence: Option<i64>) -> DeliveryRef {
    DeliveryRef {
        delivery_type: "CLIENT_UPDATE".to_string(),
        target_id: "openframe-client".to_string(),
        dispatch_id: dispatch_id.to_string(),
        sequence,
    }
}

#[test]
fn the_applied_sequence_only_moves_forward() {
    let (_dir, ledger) = ledger();
    assert_eq!(ledger.applied_sequence(), 0);

    ledger.record_applied(5).unwrap();
    ledger.record_applied(3).unwrap();
    assert_eq!(ledger.applied_sequence(), 5);
}

#[test]
fn a_settled_result_is_found_by_dispatch_and_kept_until_published() {
    let (_dir, ledger) = ledger();
    let done = DeliveryResultMessage::done(delivery("d-1", Some(2)));
    ledger.settle(done.clone()).unwrap();

    assert_eq!(ledger.settled("d-1"), Some(done.clone()));
    assert_eq!(ledger.settled("d-2"), None);
    assert_eq!(ledger.unpublished(), vec![done]);

    ledger.mark_published("d-1").unwrap();
    assert!(ledger.unpublished().is_empty());
    assert!(ledger.settled("d-1").is_some(), "kept for repeats");
}

#[test]
fn settling_a_dispatch_again_replaces_its_result() {
    let (_dir, ledger) = ledger();
    ledger
        .settle(DeliveryResultMessage::failed(delivery("d-1", None), "boom"))
        .unwrap();
    ledger.mark_published("d-1").unwrap();

    let done = DeliveryResultMessage::done(delivery("d-1", None));
    ledger.settle(done.clone()).unwrap();

    assert_eq!(ledger.settled("d-1"), Some(done.clone()));
    assert_eq!(ledger.unpublished(), vec![done]);
}

#[test]
fn an_unreadable_ledger_reads_as_empty_and_is_replaced() {
    let (dir, ledger) = ledger();
    fs::write(dir.path().join("updater_deliveries.json"), b"{not json").unwrap();
    assert_eq!(ledger.applied_sequence(), 0);

    ledger.record_applied(4).unwrap();
    assert_eq!(ledger.applied_sequence(), 4);
}

#[test]
fn old_and_excess_results_are_pruned() {
    let now = Utc::now();
    let entry = |dispatch_id: &str, age_secs: i64| SettledResult {
        message: DeliveryResultMessage::done(delivery(dispatch_id, None)),
        settled_at: now - chrono::Duration::seconds(age_secs),
        published: true,
    };
    let mut file = LedgerFile {
        applied_sequence: 0,
        settled: vec![entry("expired", DELIVERY_LEDGER_TTL_SECS + 1)],
    };
    for i in 0..DELIVERY_LEDGER_MAX_SETTLED + 1 {
        file.settled.push(entry(&format!("d-{i}"), 0));
    }

    prune(&mut file, now);

    assert_eq!(file.settled.len(), DELIVERY_LEDGER_MAX_SETTLED);
    assert!(file
        .settled
        .iter()
        .all(|e| e.message.delivery.dispatch_id != "expired"
            && e.message.delivery.dispatch_id != "d-0"));
}
