use super::*;
use serde_json::{json, Value};
use tempfile::TempDir;

const MACHINE: &str = "machine-1";
const VERSION: &str = "1.5.1";

fn handler() -> (FeatureFlagsHandler, TempDir) {
    let dir = tempfile::tempdir().unwrap();
    let service =
        FeatureFlagsService::load(dir.path().join("feature_flags.json"), VERSION.to_string());
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

fn tool_installation(value: bool, min_version: &str) -> FeatureFlagsMessage {
    message(
        json!({ "delivery-tool-installation": { "enabled": value, "minVersion": min_version } }),
    )
}

fn message(flags: Value) -> FeatureFlagsMessage {
    serde_json::from_value(json!({ "flags": flags })).unwrap()
}

#[test]
fn the_subject_is_machine_scoped() {
    assert_eq!(
        FeatureFlagsHandler::subject("abc123"),
        "machine.abc123.feature-flags"
    );
}

#[tokio::test]
async fn flags_without_a_sequence_fail() {
    let (handler, _dir) = handler();

    let outcome = handler
        .run(MACHINE, &delivery(None), tool_installation(true, "1.0.0"))
        .await;

    assert!(matches!(outcome, Outcome::Failed(_)));
    assert_eq!(handler.awaiting_restart(), None);
}

#[tokio::test]
async fn an_applicable_change_restarts_and_anything_else_is_done() {
    let cases = [
        (
            tool_installation(false, "1.0.0"),
            Outcome::Done,
            "switched off, as running",
        ),
        (
            tool_installation(true, "2.0.0"),
            Outcome::Done,
            "for a newer client",
        ),
        (
            tool_installation(true, "1.0.0"),
            Outcome::RestartRequired,
            "switched on for this client",
        ),
    ];
    for (message, expected, why) in cases {
        let (handler, _dir) = handler();

        let outcome = handler.run(MACHINE, &delivery(Some(1)), message).await;

        assert_eq!(outcome, expected, "{why}");
    }
}

#[tokio::test]
async fn a_stale_or_repeated_sequence_is_done_without_applying() {
    let (handler, _dir) = handler();
    handler
        .run(
            MACHINE,
            &delivery(Some(5)),
            tool_installation(true, "1.0.0"),
        )
        .await;

    for stale in [5, 4] {
        let outcome = handler
            .run(MACHINE, &delivery(Some(stale)), message(json!({})))
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
            tool_installation(true, "1.0.0"),
        )
        .await;

    let outcome = handler
        .run(
            "machine-2",
            &delivery(Some(3)),
            tool_installation(true, "1.0.0"),
        )
        .await;

    assert_eq!(outcome, Outcome::RestartRequired);
    assert_eq!(handler.service.applied_sequence("machine-2"), 3);
}
