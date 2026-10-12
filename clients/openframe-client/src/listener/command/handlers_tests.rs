use super::*;
use tempfile::TempDir;

const MACHINE: &str = "machine-1";

fn handler() -> (FeatureFlagsHandler, TempDir) {
    let dir = tempfile::tempdir().unwrap();
    let service = FeatureFlagsService::load(dir.path().join("feature_flags.json"));
    (FeatureFlagsHandler::new(Arc::new(service)), dir)
}

fn delivery(sequence: Option<i64>) -> DeliveryRef {
    DeliveryRef {
        delivery_type: "CLIENT_FEATURE_FLAGS".to_string(),
        target_id: "tenant".to_string(),
        dispatch_id: "dispatch".to_string(),
        sequence,
    }
}

fn message(flags: serde_json::Value) -> FeatureFlagsMessage {
    serde_json::from_value(serde_json::json!({ "flags": flags })).unwrap()
}

#[test]
fn subject_is_machine_scoped() {
    assert_eq!(
        FeatureFlagsHandler::subject("abc123"),
        "machine.abc123.feature-flags"
    );
}

#[tokio::test]
async fn flags_without_a_sequence_fail() {
    let (handler, _dir) = handler();

    let outcome = handler
        .run(
            MACHINE,
            &delivery(None),
            message(serde_json::json!({ "delivery-tool-installation": true })),
        )
        .await;

    assert!(matches!(outcome, Outcome::Failed(_)));
    assert_eq!(handler.awaiting_restart(), None);
}

#[tokio::test]
async fn a_changed_set_requires_a_restart_and_an_unchanged_one_does_not() {
    let (handler, _dir) = handler();

    let unchanged = handler
        .run(
            MACHINE,
            &delivery(Some(1)),
            message(serde_json::json!({ "delivery-tool-installation": false })),
        )
        .await;
    let changed = handler
        .run(
            MACHINE,
            &delivery(Some(2)),
            message(serde_json::json!({ "delivery-tool-installation": true })),
        )
        .await;

    assert_eq!(unchanged, Outcome::Done);
    assert_eq!(changed, Outcome::RestartRequired);
}

#[tokio::test]
async fn stale_or_repeated_sequence_is_done_without_applying() {
    let (handler, _dir) = handler();
    handler
        .run(
            MACHINE,
            &delivery(Some(5)),
            message(serde_json::json!({ "delivery-tool-installation": true })),
        )
        .await;

    for stale in [5, 4] {
        let outcome = handler
            .run(
                MACHINE,
                &delivery(Some(stale)),
                message(serde_json::json!({})),
            )
            .await;

        assert_eq!(outcome, Outcome::Done, "sequence {stale}");
        assert_eq!(handler.service.applied_sequence(MACHINE), 5);
        assert!(handler.awaiting_restart().is_some());
    }
}

#[tokio::test]
async fn a_reregistered_machine_applies_a_lower_sequence() {
    let (handler, _dir) = handler();
    handler
        .run(
            MACHINE,
            &delivery(Some(50)),
            message(serde_json::json!({ "delivery-tool-installation": true })),
        )
        .await;

    let outcome = handler
        .run(
            "machine-2",
            &delivery(Some(3)),
            message(serde_json::json!({ "delivery-tool-installation": true })),
        )
        .await;

    assert_eq!(outcome, Outcome::RestartRequired);
    assert_eq!(handler.service.applied_sequence("machine-2"), 3);
}
