use super::*;
use tempfile::tempdir;

fn store() -> (ResultStore, tempfile::TempDir) {
    let dir = tempdir().unwrap();
    let path = dir.path().join("outbox.redb");
    (ResultStore::open_or_degrade(path), dir)
}

fn record(execution_id: &str, script_id: &str) -> (String, JournalRecord) {
    let key = entry_key(execution_id, Some(script_id));
    (
        key,
        JournalRecord {
            subject: "machine.m.script-execution.result".to_string(),
            execution_id: execution_id.to_string(),
            schedule_id: Some("sch".to_string()),
            machine_id: "m".to_string(),
            script_id: Some(script_id.to_string()),
            started: false,
            created_at_secs: now_secs(),
        },
    )
}

fn result(execution_id: &str, script_id: &str) -> RmmResult {
    RmmResult {
        execution_id: execution_id.to_string(),
        machine_id: "m".to_string(),
        stdout: "ok".to_string(),
        stderr: String::new(),
        exit_code: 0,
        execution_time_ms: 1,
        timed_out: false,
        error: None,
        script_id: Some(script_id.to_string()),
        schedule_id: Some("sch".to_string()),
    }
}

#[tokio::test]
async fn invariant_journal_xor_outbox() {
    let (s, _d) = store();
    let (key, rec) = record("ex", "a");
    assert!(s
        .journal_batch("ex".to_string(), vec![(key.clone(), rec)])
        .await
        .unwrap());

    assert!(s.has_batch("ex").await.unwrap());
    assert!(s.pending_keys().await.unwrap().is_empty());

    let bytes = ResultStore::encode_result(&result("ex", "a"), payload_limit(None));
    s.complete(key.clone(), "subj".to_string(), bytes)
        .await
        .unwrap();

    assert!(!s.has_batch("ex").await.unwrap());
    let pending = s.pending_keys().await.unwrap();
    assert_eq!(pending, vec![(key, "subj".to_string())]);
}

#[tokio::test]
async fn journal_batch_rejects_duplicate_execution() {
    let (s, _d) = store();
    let (k1, r1) = record("ex", "a");
    assert!(s
        .journal_batch("ex".to_string(), vec![(k1, r1)])
        .await
        .unwrap());

    let (k2, r2) = record("ex", "b");
    assert!(
        !s.journal_batch("ex".to_string(), vec![(k2, r2)])
            .await
            .unwrap(),
        "a second batch with the same execution_id must be rejected"
    );
    assert!(s.has_batch("ex").await.unwrap());
}

#[tokio::test]
async fn write_ahead_survives_reopen() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("outbox.redb");
    let key = entry_key("ex", Some("a"));
    {
        let s = ResultStore::open_or_degrade(path.clone());
        let bytes = ResultStore::encode_result(&result("ex", "a"), payload_limit(None));
        s.complete(key.clone(), "subj".to_string(), bytes)
            .await
            .unwrap();
    }
    let s = ResultStore::open_or_degrade(path);
    assert_eq!(s.pending_keys().await.unwrap().len(), 1);
    assert!(s.load_payload(key).await.unwrap().is_some());
}

#[tokio::test]
async fn recover_distinguishes_started_flag() {
    let (s, _d) = store();
    let (k1, r1) = record("ex", "a");
    let (k2, mut r2) = record("ex", "b");
    r2.started = true;
    s.journal_batch("ex".to_string(), vec![(k1, r1), (k2, r2)])
        .await
        .unwrap();

    let recovered = s.recover().await.unwrap();
    assert_eq!(recovered, 2);
    assert!(!s.has_batch("ex").await.unwrap());

    let mut errors: Vec<String> = Vec::new();
    for (key, _) in s.pending_keys().await.unwrap() {
        let bytes = s.load_payload(key).await.unwrap().unwrap();
        let r: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(r["exit_code"], 85);
        errors.push(r["error"].as_str().unwrap().to_string());
    }
    errors.sort();
    assert_eq!(
        errors,
        vec![ERROR_INTERRUPTED.to_string(), ERROR_NOT_STARTED.to_string()]
    );
}

#[tokio::test]
async fn recover_is_idempotent() {
    let (s, _d) = store();
    let (k, r) = record("ex", "a");
    s.journal_batch("ex".to_string(), vec![(k, r)])
        .await
        .unwrap();
    assert_eq!(s.recover().await.unwrap(), 1);
    assert_eq!(s.recover().await.unwrap(), 0);
    assert_eq!(s.pending_keys().await.unwrap().len(), 1);
}

#[tokio::test]
async fn same_batch_two_scripts_coexist() {
    let (s, _d) = store();
    let a = ResultStore::encode_result(&result("ex", "a"), payload_limit(None));
    let b = ResultStore::encode_result(&result("ex", "b"), payload_limit(None));
    s.complete(entry_key("ex", Some("a")), "subj".to_string(), a)
        .await
        .unwrap();
    s.complete(entry_key("ex", Some("b")), "subj".to_string(), b)
        .await
        .unwrap();
    assert_eq!(s.pending_keys().await.unwrap().len(), 2);
}

#[tokio::test]
async fn enqueue_persists_without_a_journal_row() {
    let (s, _d) = store();
    // enqueue does NOT create a journal entry (unlike complete).
    s.enqueue("ack:ex".to_string(), "subj".to_string(), b"hi".to_vec())
        .await
        .unwrap();
    assert!(
        !s.has_batch("ex").await.unwrap(),
        "enqueue must not journal"
    );
    let pending = s.pending_keys().await.unwrap();
    assert_eq!(pending, vec![("ack:ex".to_string(), "subj".to_string())]);
    assert_eq!(
        s.load_payload("ack:ex".to_string()).await.unwrap().unwrap(),
        b"hi"
    );
}

#[tokio::test]
async fn ack_and_result_entries_coexist_under_distinct_keys() {
    let (s, _d) = store();
    s.enqueue(
        "ack:ex".to_string(),
        "ack-subj".to_string(),
        b"ack".to_vec(),
    )
    .await
    .unwrap();
    let r = ResultStore::encode_result(&result("ex", "a"), payload_limit(None));
    s.enqueue(entry_key("ex", Some("a")), "result-subj".to_string(), r)
        .await
        .unwrap();
    assert_eq!(s.pending_keys().await.unwrap().len(), 2);
}

#[tokio::test]
async fn oversize_result_is_truncated_under_limit() {
    let limit = payload_limit(None);
    let mut r = result("ex", "a");
    r.stdout = "x".repeat(limit + 1024);
    r.stderr = "diagnostic".to_string();
    let bytes = ResultStore::encode_result(&r, limit);
    assert!(bytes.len() <= limit);
    let decoded: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(decoded["error"], TRUNCATION_MARKER);
    assert_eq!(
        decoded["stderr"], "diagnostic",
        "stderr preferred over stdout"
    );
}

#[tokio::test]
async fn prune_keeps_newest_drops_oldest() {
    let (s, _d) = store();
    for i in 0..5 {
        let mut r = record("ex", &format!("s{}", i));
        r.1.created_at_secs = i as u64;
        let bytes =
            ResultStore::encode_result(&result("ex", &format!("s{}", i)), payload_limit(None));
        s.complete(r.0, "subj".to_string(), bytes).await.unwrap();
    }
    let dropped = s.prune_oldest(2).await.unwrap();
    assert_eq!(dropped, 3);
    assert_eq!(s.len().await.unwrap(), 2);
}

#[test]
fn payload_limit_follows_live_max_payload() {
    use crate::config::update_config::{NATS_PAYLOAD_FALLBACK_BYTES, NATS_PAYLOAD_HEADROOM_BYTES};

    // Unknown live value → fallback minus headroom.
    assert_eq!(
        payload_limit(None),
        NATS_PAYLOAD_FALLBACK_BYTES - NATS_PAYLOAD_HEADROOM_BYTES
    );
    // A raised server limit is honored automatically.
    let raised = 8 * 1024 * 1024;
    assert_eq!(
        payload_limit(Some(raised)),
        raised - NATS_PAYLOAD_HEADROOM_BYTES
    );
    // A pathologically small limit saturates to 0 rather than underflowing.
    assert_eq!(payload_limit(Some(1024)), 0);
}

const SUBJECT: &str = "machine.m.delivery.result";

fn delivery(delivery_type: &str, dispatch_id: &str, sequence: Option<i64>) -> DeliveryRef {
    DeliveryRef {
        delivery_type: delivery_type.to_string(),
        target_id: "target".to_string(),
        dispatch_id: dispatch_id.to_string(),
        sequence,
    }
}

fn done(delivery: DeliveryRef) -> DeliveryResultMessage {
    DeliveryResultMessage {
        delivery,
        result: DeliveryResult::Done,
        error: None,
    }
}

async fn claim(s: &ResultStore, delivery: &DeliveryRef) -> DeliveryClaim {
    s.delivery_claim(SUBJECT.to_string(), delivery.clone())
        .await
        .unwrap()
}

async fn queued(s: &ResultStore, dispatch_id: &str) -> Option<DeliveryResultMessage> {
    s.load_payload(format!("delivery:{dispatch_id}"))
        .await
        .unwrap()
        .map(|bytes| serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
async fn a_repeated_dispatch_is_dropped_while_in_flight_and_runs_again_once_released() {
    let (s, _d) = store();
    let install = delivery("TOOL_INSTALLATION", "d1", None);

    assert_eq!(claim(&s, &install).await, DeliveryClaim::Claimed);
    assert_eq!(claim(&s, &install).await, DeliveryClaim::InFlight);

    s.delivery_release("d1".to_string()).await.unwrap();
    assert_eq!(claim(&s, &install).await, DeliveryClaim::Claimed);
}

#[tokio::test]
async fn a_settled_dispatch_re_sends_its_result_instead_of_running_again() {
    let (s, _d) = store();
    let install = delivery("TOOL_INSTALLATION", "d1", None);
    claim(&s, &install).await;
    s.delivery_settle(SUBJECT.to_string(), done(install.clone()))
        .await
        .unwrap();
    s.remove("delivery:d1".to_string()).await.unwrap();

    assert_eq!(claim(&s, &install).await, DeliveryClaim::Resent);
    assert_eq!(queued(&s, "d1").await, Some(done(install)));
}

#[tokio::test]
async fn a_recorded_result_is_re_sent_on_a_repeat_but_never_queued_itself() {
    let (s, _d) = store();
    let uninstall = delivery("CLIENT_UNINSTALL", "d1", None);
    claim(&s, &uninstall).await;

    s.delivery_record(SUBJECT.to_string(), done(uninstall.clone()))
        .await
        .unwrap();
    assert_eq!(queued(&s, "d1").await, None);

    assert_eq!(claim(&s, &uninstall).await, DeliveryClaim::Resent);
    assert_eq!(queued(&s, "d1").await, Some(done(uninstall)));
}

#[tokio::test]
async fn recovery_fails_only_what_was_in_flight() {
    let (s, _d) = store();
    let interrupted = delivery("TOOL_INSTALLATION", "in-flight", None);
    let restarting = delivery("CLIENT_UPDATE", "restarting", Some(3));
    let settled = delivery("TOOL_UPDATE", "settled", Some(2));
    for d in [&interrupted, &restarting, &settled] {
        claim(&s, d).await;
    }
    s.delivery_await_restart("restarting".to_string())
        .await
        .unwrap();
    s.delivery_settle(SUBJECT.to_string(), done(settled.clone()))
        .await
        .unwrap();
    s.remove("delivery:settled".to_string()).await.unwrap();

    assert_eq!(s.recover_deliveries().await.unwrap(), 1);

    let failed = queued(&s, "in-flight").await.unwrap();
    assert_eq!(failed.result, DeliveryResult::Failed);
    assert_eq!(
        failed.error.as_deref(),
        Some("interrupted by agent restart")
    );
    assert_eq!(queued(&s, "restarting").await, None);
    assert_eq!(queued(&s, "settled").await, None);
    assert_eq!(claim(&s, &interrupted).await, DeliveryClaim::Resent);
    assert_eq!(claim(&s, &restarting).await, DeliveryClaim::InFlight);
    assert_eq!(s.recover_deliveries().await.unwrap(), 0);
}

#[tokio::test]
async fn the_next_start_settles_only_its_own_type_waiting_for_the_restart() {
    let (s, _d) = store();
    let update = delivery("CLIENT_UPDATE", "update", Some(4));
    let flags = delivery("CLIENT_FEATURE_FLAGS", "flags", Some(9));
    let running = delivery("CLIENT_UPDATE", "running", Some(5));
    for d in [&update, &flags, &running] {
        claim(&s, d).await;
    }
    for id in ["update", "flags"] {
        s.delivery_await_restart(id.to_string()).await.unwrap();
    }

    let settled = s
        .delivery_settle_awaiting_restart(
            "CLIENT_UPDATE".to_string(),
            DeliveryResult::Failed,
            Some("rolled back".to_string()),
        )
        .await
        .unwrap();

    assert_eq!(settled, 1);
    let failed = queued(&s, "update").await.unwrap();
    assert_eq!(failed.result, DeliveryResult::Failed);
    assert_eq!(failed.error.as_deref(), Some("rolled back"));
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
        state: LedgerState::Settled(done(old.clone())),
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
    claim(&s, &fresh).await;
    s.delivery_settle(SUBJECT.to_string(), done(fresh))
        .await
        .unwrap();

    assert_eq!(claim(&s, &old).await, DeliveryClaim::Claimed);
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
