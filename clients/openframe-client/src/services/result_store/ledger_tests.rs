use super::*;
use std::path::PathBuf;
use tempfile::{tempdir, TempDir};

const SUBJECT: &str = "machine.m.delivery.result";

fn store() -> (ResultStore, TempDir) {
    let dir = tempdir().unwrap();
    let path: PathBuf = dir.path().join("outbox.redb");
    (ResultStore::open_or_degrade(path), dir)
}

fn delivery(delivery_type: &str, dispatch_id: &str, sequence: Option<i64>) -> DeliveryRef {
    DeliveryRef {
        delivery_type: delivery_type.to_string(),
        target_id: "target".to_string(),
        dispatch_id: dispatch_id.to_string(),
        sequence,
    }
}

async fn accept(s: &ResultStore, delivery: &DeliveryRef, state: LedgerState) {
    s.delivery_accept(SUBJECT.to_string(), delivery.clone(), state)
        .await
        .unwrap();
}

async fn state(s: &ResultStore, dispatch_id: &str) -> Option<LedgerState> {
    s.delivery_state(dispatch_id.to_string()).await.unwrap()
}

async fn queued(s: &ResultStore, dispatch_id: &str) -> Option<DeliveryResultMessage> {
    s.load_payload(format!("delivery:{dispatch_id}"))
        .await
        .unwrap()
        .map(|bytes| serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
async fn an_accepted_dispatch_stays_in_flight_until_its_result_is_queued() {
    let (s, _d) = store();
    let install = delivery("TOOL_INSTALLATION", "d1", None);
    assert_eq!(state(&s, "d1").await, None);

    accept(&s, &install, LedgerState::InFlight).await;
    assert_eq!(state(&s, "d1").await, Some(LedgerState::InFlight));

    let done = DeliveryResultMessage::done(install);
    s.delivery_settle(SUBJECT.to_string(), done.clone())
        .await
        .unwrap();
    assert_eq!(
        state(&s, "d1").await,
        Some(LedgerState::Settled(done.clone()))
    );
    assert_eq!(queued(&s, "d1").await, Some(done));
}

#[tokio::test]
async fn a_recorded_result_is_kept_for_repeats_but_never_queued() {
    let (s, _d) = store();
    let uninstall = delivery("CLIENT_UNINSTALL", "d1", None);
    accept(&s, &uninstall, LedgerState::InFlight).await;

    let done = DeliveryResultMessage::done(uninstall);
    s.delivery_record(SUBJECT.to_string(), done.clone())
        .await
        .unwrap();

    assert_eq!(queued(&s, "d1").await, None);
    assert_eq!(state(&s, "d1").await, Some(LedgerState::Settled(done)));
}

#[tokio::test]
async fn recovery_fails_only_what_was_in_flight() {
    let (s, _d) = store();
    let interrupted = delivery("TOOL_INSTALLATION", "in-flight", None);
    let restarting = delivery("CLIENT_UPDATE", "restarting", Some(3));
    let settled = delivery("TOOL_UPDATE", "settled", Some(2));
    accept(&s, &interrupted, LedgerState::InFlight).await;
    accept(&s, &restarting, LedgerState::AwaitingRestart).await;
    s.delivery_settle(SUBJECT.to_string(), DeliveryResultMessage::done(settled))
        .await
        .unwrap();
    s.remove("delivery:settled".to_string()).await.unwrap();

    assert_eq!(s.recover_deliveries().await.unwrap(), 1);

    let failed = DeliveryResultMessage::failed(interrupted, "interrupted by agent restart");
    assert_eq!(queued(&s, "in-flight").await, Some(failed.clone()));
    assert_eq!(
        state(&s, "in-flight").await,
        Some(LedgerState::Settled(failed))
    );
    assert_eq!(queued(&s, "restarting").await, None);
    assert_eq!(queued(&s, "settled").await, None);
    assert_eq!(
        state(&s, "restarting").await,
        Some(LedgerState::AwaitingRestart)
    );
    assert_eq!(s.recover_deliveries().await.unwrap(), 0);
}

#[tokio::test]
async fn a_restart_required_dispatch_waits_for_the_next_start() {
    let (s, _d) = store();
    let flags = delivery("CLIENT_FEATURE_FLAGS", "flags", Some(9));
    accept(&s, &flags, LedgerState::InFlight).await;

    s.delivery_await_restart("flags".to_string()).await.unwrap();

    assert_eq!(state(&s, "flags").await, Some(LedgerState::AwaitingRestart));
    assert_eq!(s.recover_deliveries().await.unwrap(), 0);
}

#[tokio::test]
async fn a_deferred_dispatch_survives_restarts_until_its_owner_settles_it() {
    let (s, _d) = store();
    let order = delivery("PACKAGE_UPDATE", "order", Some(4));
    accept(&s, &order, LedgerState::InFlight).await;

    s.delivery_defer("order".to_string()).await.unwrap();

    assert_eq!(s.recover_deliveries().await.unwrap(), 0);
    assert_eq!(state(&s, "order").await, Some(LedgerState::Deferred));
    assert_eq!(queued(&s, "order").await, None);
    let failed = DeliveryResultMessage::failed(order, "MANAGER_ERROR: boom");
    s.delivery_settle(SUBJECT.to_string(), failed.clone())
        .await
        .unwrap();
    assert_eq!(
        state(&s, "order").await,
        Some(LedgerState::Settled(failed.clone()))
    );
    assert_eq!(queued(&s, "order").await, Some(failed));
}

#[tokio::test]
async fn the_next_start_settles_only_its_own_type_waiting_for_the_restart() {
    let (s, _d) = store();
    let update = delivery("CLIENT_UPDATE", "update", Some(4));
    let flags = delivery("CLIENT_FEATURE_FLAGS", "flags", Some(9));
    let running = delivery("CLIENT_UPDATE", "running", Some(5));
    accept(&s, &update, LedgerState::AwaitingRestart).await;
    accept(&s, &flags, LedgerState::AwaitingRestart).await;
    accept(&s, &running, LedgerState::InFlight).await;

    let settled = s
        .delivery_settle_awaiting_restart(
            "CLIENT_UPDATE".to_string(),
            DeliveryResult::Failed,
            Some("rolled back".to_string()),
        )
        .await
        .unwrap();

    assert_eq!(settled, vec![update.clone()]);
    assert_eq!(
        queued(&s, "update").await,
        Some(DeliveryResultMessage::failed(update, "rolled back"))
    );
    assert_eq!(queued(&s, "flags").await, None);
    assert_eq!(queued(&s, "running").await, None);
}

#[tokio::test]
async fn an_expired_settled_entry_is_forgotten_on_the_next_settle() {
    let (s, _d) = store();
    let old = delivery("TOOL_INSTALLATION", "old", None);
    let record = LedgerRecord {
        subject: SUBJECT.to_string(),
        delivery: old.clone(),
        state: LedgerState::Settled(DeliveryResultMessage::done(old)),
        updated_at_secs: now_secs() - DELIVERY_LEDGER_TTL_SECS - 1,
    };
    s.with_db(move |db| {
        let txn = db.begin_write()?;
        {
            write_ledger(&mut txn.open_table(DELIVERY_LEDGER)?, &record)?;
        }
        txn.commit()?;
        Ok(())
    })
    .await
    .unwrap();

    let fresh = delivery("TOOL_INSTALLATION", "fresh", None);
    s.delivery_settle(SUBJECT.to_string(), DeliveryResultMessage::done(fresh))
        .await
        .unwrap();

    assert_eq!(state(&s, "old").await, None);
}

#[tokio::test]
async fn the_applied_sequence_belongs_to_one_registration_and_never_goes_down() {
    let (s, _d) = store();
    let update = delivery("TOOL_UPDATE", "d1", Some(7));
    assert_eq!(s.applied_sequence(&update, "m").await.unwrap(), 0);

    s.record_applied_sequence(&update, "m", 7).await.unwrap();
    s.record_applied_sequence(&update, "m", 5).await.unwrap();

    assert_eq!(s.applied_sequence(&update, "m").await.unwrap(), 7);
    assert_eq!(s.applied_sequence(&update, "m2").await.unwrap(), 0);
    let other_target = DeliveryRef {
        target_id: "other".to_string(),
        ..update.clone()
    };
    assert_eq!(s.applied_sequence(&other_target, "m").await.unwrap(), 0);

    s.record_applied_sequence(&update, "m2", 3).await.unwrap();
    assert_eq!(s.applied_sequence(&update, "m2").await.unwrap(), 3);
    assert_eq!(s.applied_sequence(&update, "m").await.unwrap(), 0);
}

#[tokio::test]
async fn an_unreadable_ledger_entry_neither_blocks_recovery_nor_reads_as_known() {
    let (s, _d) = store();
    s.with_db(|db| {
        let txn = db.begin_write()?;
        {
            txn.open_table(DELIVERY_LEDGER)?
                .insert("future", br#"{"state":"from_a_newer_version"}"#.as_slice())?;
        }
        txn.commit()?;
        Ok(())
    })
    .await
    .unwrap();
    let interrupted = delivery("TOOL_INSTALLATION", "in-flight", None);
    accept(&s, &interrupted, LedgerState::InFlight).await;

    assert_eq!(s.recover_deliveries().await.unwrap(), 1);
    assert_eq!(state(&s, "future").await, None);
}

#[tokio::test]
async fn only_an_in_flight_row_moves_to_waiting() {
    let (s, _d) = store();
    let restarting = delivery("CLIENT_UPDATE", "restarting", Some(1));
    let settled = delivery("PACKAGE_UPDATE", "settled", Some(2));
    accept(&s, &restarting, LedgerState::AwaitingRestart).await;
    let done = DeliveryResultMessage::done(settled);
    s.delivery_settle(SUBJECT.to_string(), done.clone())
        .await
        .unwrap();

    for id in ["restarting", "settled", "unknown"] {
        s.delivery_defer(id.to_string()).await.unwrap();
    }

    assert_eq!(
        state(&s, "restarting").await,
        Some(LedgerState::AwaitingRestart)
    );
    assert_eq!(state(&s, "settled").await, Some(LedgerState::Settled(done)));
    assert_eq!(state(&s, "unknown").await, None);
}

#[tokio::test]
async fn a_result_settled_before_the_handler_defers_is_not_overwritten() {
    let (s, _d) = store();
    let order = delivery("PACKAGE_UPDATE", "order", Some(3));
    accept(&s, &order, LedgerState::InFlight).await;
    let done = DeliveryResultMessage::done(order);
    s.delivery_settle(SUBJECT.to_string(), done.clone())
        .await
        .unwrap();

    s.delivery_defer("order".to_string()).await.unwrap();

    assert_eq!(state(&s, "order").await, Some(LedgerState::Settled(done)));
}

#[test]
fn a_deferred_row_is_stored_under_its_own_name() {
    assert_eq!(
        serde_json::to_value(LedgerState::Deferred).unwrap(),
        serde_json::json!("deferred")
    );
    assert_eq!(
        serde_json::from_value::<LedgerState>(serde_json::json!("in_flight")).unwrap(),
        LedgerState::InFlight
    );
}

#[tokio::test]
async fn deferred_rows_of_several_dispatches_settle_one_by_one() {
    let (s, _d) = store();
    let ids = ["wait", "now", "deadline"];
    for (sequence, id) in ids.iter().enumerate() {
        let order = delivery("PACKAGE_UPDATE", id, Some(sequence as i64));
        accept(&s, &order, LedgerState::InFlight).await;
        s.delivery_defer(id.to_string()).await.unwrap();
    }
    assert_eq!(s.recover_deliveries().await.unwrap(), 0);

    let failed =
        DeliveryResultMessage::failed(delivery("PACKAGE_UPDATE", "now", Some(1)), "TIMEOUT");
    s.delivery_settle(SUBJECT.to_string(), failed.clone())
        .await
        .unwrap();

    assert_eq!(state(&s, "wait").await, Some(LedgerState::Deferred));
    assert_eq!(state(&s, "now").await, Some(LedgerState::Settled(failed)));
    assert_eq!(state(&s, "deadline").await, Some(LedgerState::Deferred));
    assert_eq!(queued(&s, "wait").await, None);
}

#[tokio::test]
async fn deferred_rows_no_work_owns_fail_and_the_rest_stay() {
    let (s, _d) = store();
    let owned = delivery("PACKAGE_UPDATE", "owned", Some(1));
    let lost = delivery("PACKAGE_UPDATE", "lost", Some(2));
    let other_type = delivery("OTHER", "other-type", Some(3));
    let in_flight = delivery("PACKAGE_UPDATE", "in-flight", Some(4));
    for row in [&owned, &lost, &other_type] {
        accept(&s, row, LedgerState::InFlight).await;
        s.delivery_defer(row.dispatch_id.clone()).await.unwrap();
    }
    accept(&s, &in_flight, LedgerState::InFlight).await;

    let failed = s
        .delivery_settle_orphaned(
            "PACKAGE_UPDATE".to_string(),
            ["owned".to_string()].into_iter().collect(),
        )
        .await
        .unwrap();

    assert_eq!(failed, vec![lost.clone()]);
    let answer = DeliveryResultMessage::failed(lost, "the agent lost the work it took on");
    assert_eq!(queued(&s, "lost").await, Some(answer.clone()));
    assert_eq!(state(&s, "lost").await, Some(LedgerState::Settled(answer)));
    assert_eq!(state(&s, "owned").await, Some(LedgerState::Deferred));
    assert_eq!(state(&s, "other-type").await, Some(LedgerState::Deferred));
    assert_eq!(state(&s, "in-flight").await, Some(LedgerState::InFlight));
    assert!(s
        .delivery_settle_orphaned("PACKAGE_UPDATE".to_string(), Default::default())
        .await
        .unwrap()
        .contains(&owned));
}
