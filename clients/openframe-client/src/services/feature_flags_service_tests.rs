use super::*;
use crate::models::Feature;
use tempfile::TempDir;

const MACHINE: &str = "machine-1";

fn flags_path() -> (PathBuf, TempDir) {
    let dir = tempfile::tempdir().unwrap();
    (dir.path().join("feature_flags.json"), dir)
}

fn delivery(sequence: i64) -> DeliveryRef {
    DeliveryRef {
        delivery_type: "CLIENT_FEATURE_FLAGS".to_string(),
        target_id: "tenant".to_string(),
        dispatch_id: format!("dispatch-{sequence}"),
        sequence: Some(sequence),
    }
}

fn message(flags: serde_json::Value) -> FeatureFlagsMessage {
    serde_json::from_value(serde_json::json!({ "flags": flags })).unwrap()
}

fn apply(service: &FeatureFlagsService, sequence: i64, flags: serde_json::Value) -> FlagsApplied {
    service
        .apply(MACHINE, &delivery(sequence), sequence, message(flags))
        .unwrap()
}

fn tool_installation_delivery(service: &FeatureFlagsService) -> bool {
    service
        .flags()
        .is_enabled(Feature::DeliveryToolInstallation)
}

#[test]
fn missing_file_means_every_feature_off() {
    let (path, _dir) = flags_path();

    let service = FeatureFlagsService::load(path);

    assert!(!tool_installation_delivery(&service));
    assert_eq!(service.applied_sequence(MACHINE), 0);
    assert_eq!(service.awaiting_restart(), None);
}

#[test]
fn corrupt_file_means_every_feature_off() {
    let (path, _dir) = flags_path();
    std::fs::write(&path, b"{ not json").unwrap();

    let service = FeatureFlagsService::load(path);

    assert!(!tool_installation_delivery(&service));
    assert_eq!(service.applied_sequence(MACHINE), 0);
}

#[test]
fn enabling_a_feature_needs_a_restart_and_takes_effect_on_next_start() {
    let (path, _dir) = flags_path();
    let service = FeatureFlagsService::load(path.clone());

    let applied = apply(
        &service,
        7,
        serde_json::json!({ "delivery-tool-installation": true }),
    );

    assert_eq!(applied, FlagsApplied::RestartRequired);
    assert!(!tool_installation_delivery(&service));
    assert_eq!(service.awaiting_restart(), Some(delivery(7)));

    let restarted = FeatureFlagsService::load(path);
    assert!(tool_installation_delivery(&restarted));
    assert_eq!(restarted.applied_sequence(MACHINE), 7);
    assert_eq!(restarted.awaiting_restart(), Some(delivery(7)));
}

#[test]
fn reported_restart_is_not_reported_again() {
    let (path, _dir) = flags_path();
    let service = FeatureFlagsService::load(path.clone());
    apply(
        &service,
        7,
        serde_json::json!({ "delivery-tool-installation": true }),
    );

    let restarted = FeatureFlagsService::load(path.clone());
    restarted.restart_reported().unwrap();

    assert_eq!(restarted.awaiting_restart(), None);
    let next_start = FeatureFlagsService::load(path);
    assert_eq!(next_start.awaiting_restart(), None);
    assert!(tool_installation_delivery(&next_start));
}

#[test]
fn absent_false_and_non_boolean_all_resolve_to_the_default() {
    for flags in [
        serde_json::json!({}),
        serde_json::json!({ "delivery-tool-installation": false }),
        serde_json::json!({ "delivery-tool-installation": "true" }),
        serde_json::json!({ "delivery-tool-installation": 1 }),
        serde_json::json!({ "delivery-tool-installation": null }),
    ] {
        let (path, _dir) = flags_path();
        let service = FeatureFlagsService::load(path);

        let applied = apply(&service, 1, flags.clone());

        assert_eq!(applied, FlagsApplied::Unchanged, "flags: {flags}");
        assert_eq!(service.awaiting_restart(), None, "flags: {flags}");
    }
}

#[test]
fn unknown_flags_are_kept_on_disk_but_change_nothing() {
    let (path, _dir) = flags_path();
    let service = FeatureFlagsService::load(path.clone());

    let applied = apply(&service, 3, serde_json::json!({ "FUTURE_FEATURE": true }));

    assert_eq!(applied, FlagsApplied::Unchanged);
    let persisted: FeatureFlagsState =
        serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    assert_eq!(persisted.flags.get("FUTURE_FEATURE"), Some(&true));
}

#[test]
fn flipping_back_before_the_restart_cancels_it() {
    let (path, _dir) = flags_path();
    let service = FeatureFlagsService::load(path);

    apply(
        &service,
        1,
        serde_json::json!({ "delivery-tool-installation": true }),
    );
    let applied = apply(
        &service,
        2,
        serde_json::json!({ "delivery-tool-installation": false }),
    );

    assert_eq!(applied, FlagsApplied::Unchanged);
    assert_eq!(service.awaiting_restart(), None);
    assert_eq!(service.applied_sequence(MACHINE), 2);
}

#[test]
fn persisted_state_matches_the_documented_shape() {
    let (path, _dir) = flags_path();
    let service = FeatureFlagsService::load(path.clone());

    apply(
        &service,
        42,
        serde_json::json!({ "delivery-tool-installation": true }),
    );

    let persisted: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    assert_eq!(
        persisted,
        serde_json::json!({
            "machine_id": MACHINE,
            "sequence": 42,
            "flags": { "delivery-tool-installation": true },
            "awaiting_restart": {
                "type": "CLIENT_FEATURE_FLAGS",
                "targetId": "tenant",
                "dispatchId": "dispatch-42",
                "sequence": 42
            }
        })
    );
}

#[test]
fn a_new_registration_accepts_any_sequence_and_keeps_flags_until_then() {
    let (path, _dir) = flags_path();
    let service = FeatureFlagsService::load(path.clone());
    apply(
        &service,
        50,
        serde_json::json!({ "delivery-tool-installation": true }),
    );

    let restarted = FeatureFlagsService::load(path);

    assert_eq!(restarted.applied_sequence(MACHINE), 50);
    assert_eq!(restarted.applied_sequence("machine-2"), 0);
    assert!(tool_installation_delivery(&restarted));
}

#[test]
fn a_file_without_machine_id_accepts_the_first_set() {
    let (path, _dir) = flags_path();
    std::fs::write(
        &path,
        br#"{ "sequence": 9, "flags": { "delivery-tool-installation": true } }"#,
    )
    .unwrap();

    let service = FeatureFlagsService::load(path);

    assert!(tool_installation_delivery(&service));
    assert_eq!(service.applied_sequence(MACHINE), 0);
}

#[test]
fn the_backend_flag_names_map_to_their_features() {
    let (path, _dir) = flags_path();
    let service = FeatureFlagsService::load(path.clone());

    apply(
        &service,
        1,
        serde_json::json!({
            "delivery-tool-installation": true,
            "delivery-client-uninstall": true,
            "delivery-client-update": false
        }),
    );

    let restarted = FeatureFlagsService::load(path);
    assert!(restarted
        .flags()
        .is_enabled(Feature::DeliveryToolInstallation));
    assert!(restarted
        .flags()
        .is_enabled(Feature::DeliveryClientUninstall));
    assert!(!restarted.flags().is_enabled(Feature::DeliveryClientUpdate));
}
