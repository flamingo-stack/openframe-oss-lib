use super::*;
use crate::services::tool_run_manager::ClientUpdatePendingFlag;
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
fn the_subjects_are_machine_scoped_and_match_the_backend() {
    assert_eq!(
        FeatureFlagsHandler::subject("abc123"),
        "machine.abc123.feature-flags"
    );
    assert_eq!(
        ToolInstallationHandler::subject("abc123"),
        "machine.abc123.tool-installation.v2"
    );
    assert_eq!(
        ToolUpdateHandler::subject("abc123"),
        "machine.abc123.tool-update.v2"
    );
    assert_eq!(
        ClientUpdateHandler::subject("abc123"),
        "machine.abc123.client-update.v2"
    );
    assert_eq!(
        ClientUninstallHandler::subject("abc123"),
        "machine.abc123.client-uninstall.v2"
    );
}

#[test]
fn a_tool_command_reserves_the_tool_as_busy_unless_taken_or_behind_a_client_update() {
    let tool_ops = ToolOps::default();
    let flag = ClientUpdatePendingFlag::default();

    let Begin::Accepted(op) = reserve_tool(&tool_ops, &flag.view(), "mesh") else {
        panic!("a free tool was not reserved");
    };
    assert!(tool_ops.is_busy("mesh"), "a client update would not see it");
    assert!(matches!(
        reserve_tool(&tool_ops, &flag.view(), "mesh"),
        Begin::Busy(reason) if reason == TOOL_BUSY
    ));
    assert!(matches!(
        reserve_tool(&tool_ops, &flag.view(), "fleet"),
        Begin::Accepted(_)
    ));
    drop(op);
    assert!(!tool_ops.is_busy("mesh"));

    flag.mark();
    assert!(matches!(
        reserve_tool(&tool_ops, &flag.view(), "osquery"),
        Begin::Busy(reason) if reason == CLIENT_UPDATE_PENDING
    ));
    assert!(!tool_ops.is_busy("osquery"));
}

#[tokio::test]
async fn flags_without_a_sequence_fail() {
    let (handler, _dir) = handler();

    let outcome = handler
        .run(
            MACHINE,
            &delivery(None),
            tool_installation(true, "1.0.0"),
            (),
        )
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

        let outcome = handler.run(MACHINE, &delivery(Some(1)), message, ()).await;

        assert_eq!(outcome, expected, "{why}");
    }
}
