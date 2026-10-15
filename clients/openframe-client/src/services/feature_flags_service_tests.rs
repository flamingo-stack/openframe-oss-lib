use super::*;
use crate::config::update_config::DEV_CLIENT_VERSION;
use crate::models::Feature;
use serde_json::{json, Value};
use tempfile::TempDir;

const MACHINE: &str = "machine-1";
const VERSION: &str = "1.5.1";
const TOOL_INSTALLATION: &str = "delivery-tool-installation";

fn flags_path() -> (PathBuf, TempDir) {
    let dir = tempfile::tempdir().unwrap();
    (dir.path().join("feature_flags.json"), dir)
}

fn load(path: &std::path::Path, version: &str) -> FeatureFlagsService {
    FeatureFlagsService::load(path.to_path_buf(), version.to_string())
}

fn delivery(sequence: i64) -> DeliveryRef {
    DeliveryRef {
        delivery_type: "CLIENT_FEATURE_FLAGS".to_string(),
        target_id: "tenant".to_string(),
        dispatch_id: format!("dispatch-{sequence}"),
        sequence: Some(sequence),
    }
}

fn entry(value: bool, min_version: &str) -> Value {
    json!({ "enabled": value, "minVersion": min_version })
}

fn apply(service: &FeatureFlagsService, sequence: i64, flags: Value) -> FlagsApplied {
    let message: FeatureFlagsMessage = serde_json::from_value(json!({ "flags": flags })).unwrap();
    service
        .apply(MACHINE, &delivery(sequence), sequence, message)
        .unwrap()
}

fn tool_installation(service: &FeatureFlagsService) -> bool {
    service
        .flags()
        .is_enabled(Feature::DeliveryToolInstallation)
}

fn persisted(path: &std::path::Path) -> FeatureFlagsState {
    serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap()
}

fn running_with_tool_installation_on(path: &std::path::Path) -> FeatureFlagsService {
    let first = load(path, VERSION);
    apply(
        &first,
        10,
        json!({ TOOL_INSTALLATION: entry(true, "1.0.0") }),
    );
    let running = load(path, VERSION);
    running.restart_reported().unwrap();
    assert!(tool_installation(&running));
    running
}

#[test]
fn a_missing_file_means_every_feature_off() {
    let (path, _dir) = flags_path();

    let service = load(&path, VERSION);

    assert!(!tool_installation(&service));
    assert_eq!(service.applied_sequence(MACHINE), 0);
    assert_eq!(service.awaiting_restart(), None);
}

#[test]
fn an_unreadable_file_means_every_feature_off() {
    for contents in [
        &b"{ not json"[..],
        br#"{ "sequence": 9, "flags": { "delivery-tool-installation": true } }"#,
        br#"{ "sequence": 9 }"#,
    ] {
        let (path, _dir) = flags_path();
        std::fs::write(&path, contents).unwrap();

        let service = load(&path, VERSION);

        assert!(
            !tool_installation(&service),
            "{}",
            String::from_utf8_lossy(contents)
        );
        assert_eq!(service.applied_sequence(MACHINE), 0);
    }
}

#[test]
fn turning_on_an_applicable_flag_restarts_and_takes_effect_in_the_next_process() {
    let (path, _dir) = flags_path();
    let service = load(&path, VERSION);

    let applied = apply(
        &service,
        7,
        json!({ TOOL_INSTALLATION: entry(true, "1.5.1") }),
    );

    assert_eq!(applied, FlagsApplied::RestartRequired);
    assert!(!tool_installation(&service));
    assert_eq!(service.awaiting_restart(), Some(delivery(7)));

    let restarted = load(&path, VERSION);
    assert!(tool_installation(&restarted));
    assert_eq!(restarted.applied_sequence(MACHINE), 7);
    assert_eq!(restarted.awaiting_restart(), Some(delivery(7)));
}

#[test]
fn turning_off_a_running_flag_restarts() {
    let (path, _dir) = flags_path();
    let service = running_with_tool_installation_on(&path);

    let applied = apply(
        &service,
        11,
        json!({ TOOL_INSTALLATION: entry(false, "1.0.0") }),
    );

    assert_eq!(applied, FlagsApplied::RestartRequired);
    assert!(!tool_installation(&load(&path, VERSION)));
}

#[test]
fn changes_that_leave_the_effective_set_alone_do_not_restart() {
    let cases = [
        (
            "a flag for a newer client",
            json!({ TOOL_INSTALLATION: entry(true, "1.0.0"), "delivery-client-uninstall": entry(true, "2.0.0") }),
        ),
        (
            "the min version moved but still applies",
            json!({ TOOL_INSTALLATION: entry(true, "1.5.1") }),
        ),
        (
            "an unknown flag added",
            json!({ TOOL_INSTALLATION: entry(true, "1.0.0"), "future-feature": entry(true, "1.0.0") }),
        ),
        (
            "an invalid entry for another feature",
            json!({ TOOL_INSTALLATION: entry(true, "1.0.0"), "delivery-client-update": true }),
        ),
        (
            "a switched-off flag for a newer client",
            json!({ TOOL_INSTALLATION: entry(true, "1.0.0"), "delivery-client-update": entry(false, "9.0.0") }),
        ),
        (
            "the same set with a newer sequence",
            json!({ TOOL_INSTALLATION: entry(true, "1.0.0") }),
        ),
    ];
    for (why, flags) in cases {
        let (path, _dir) = flags_path();
        let service = running_with_tool_installation_on(&path);

        let applied = apply(&service, 11, flags);

        assert_eq!(applied, FlagsApplied::Unchanged, "{why}");
        assert_eq!(service.awaiting_restart(), None, "{why}");
        assert_eq!(service.applied_sequence(MACHINE), 11, "{why}");
    }
}

#[test]
fn a_flag_for_a_newer_client_is_stored_without_a_restart() {
    let (path, _dir) = flags_path();
    let service = load(&path, VERSION);

    let applied = apply(
        &service,
        3,
        json!({ TOOL_INSTALLATION: entry(true, "1.6.0") }),
    );

    assert_eq!(applied, FlagsApplied::Unchanged);
    assert_eq!(service.awaiting_restart(), None);
    assert_eq!(
        persisted(&path).flags.get(TOOL_INSTALLATION),
        Some(&FeatureFlag {
            enabled: true,
            min_version: "1.6.0".to_string()
        })
    );
}

#[test]
fn the_stored_flag_turns_on_when_the_client_is_updated() {
    let (path, _dir) = flags_path();
    let before_update = load(&path, "1.5.9");
    apply(
        &before_update,
        3,
        json!({ TOOL_INSTALLATION: entry(true, "1.6.0") }),
    );

    let after_update = load(&path, "1.6.0");

    assert!(tool_installation(&after_update));
    assert_eq!(after_update.awaiting_restart(), None);
}

#[test]
fn a_rollback_below_the_min_version_turns_the_flag_off() {
    let (path, _dir) = flags_path();
    running_with_tool_installation_on(&path);

    let rolled_back = load(&path, "0.9.0");

    assert!(!tool_installation(&rolled_back));
}

#[test]
fn the_dev_build_turns_on_a_flag_whatever_its_min_version() {
    let (path, _dir) = flags_path();
    let service = load(&path, DEV_CLIENT_VERSION);

    let applied = apply(
        &service,
        1,
        json!({ TOOL_INSTALLATION: entry(true, "99.0.0") }),
    );

    assert_eq!(applied, FlagsApplied::RestartRequired);
    assert!(tool_installation(&load(&path, DEV_CLIENT_VERSION)));
    assert!(!tool_installation(&load(&path, VERSION)));
}

#[test]
fn invalid_entries_are_dropped_and_resolve_to_the_default() {
    let cases = [
        ("a plain boolean", json!(true)),
        ("no minVersion", json!({ "enabled": true })),
        ("no value", json!({ "minVersion": "1.0.0" })),
        (
            "a string value",
            json!({ "enabled": "true", "minVersion": "1.0.0" }),
        ),
        (
            "a numeric minVersion",
            json!({ "enabled": true, "minVersion": 1 }),
        ),
        (
            "a non-semver minVersion",
            json!({ "enabled": true, "minVersion": "latest" }),
        ),
        ("null", json!(null)),
        ("a string", json!("on")),
    ];
    for (why, invalid) in cases {
        let (path, _dir) = flags_path();
        let service = load(&path, VERSION);

        let applied = apply(
            &service,
            1,
            json!({ TOOL_INSTALLATION: invalid, "delivery-client-uninstall": entry(false, "1.0.0") }),
        );

        assert_eq!(applied, FlagsApplied::Unchanged, "{why}");
        let stored = persisted(&path);
        assert_eq!(stored.flags.get(TOOL_INSTALLATION), None, "{why}");
        assert!(
            stored.flags.contains_key("delivery-client-uninstall"),
            "{why}"
        );
    }
}

#[test]
fn unknown_flags_are_kept_on_disk() {
    let (path, _dir) = flags_path();
    let service = load(&path, VERSION);

    apply(
        &service,
        3,
        json!({ "future-feature": entry(true, "1.0.0") }),
    );

    assert!(persisted(&path).flags.contains_key("future-feature"));
}

#[test]
fn flipping_back_before_the_restart_cancels_it() {
    let (path, _dir) = flags_path();
    let service = load(&path, VERSION);

    apply(
        &service,
        1,
        json!({ TOOL_INSTALLATION: entry(true, "1.0.0") }),
    );
    let applied = apply(
        &service,
        2,
        json!({ TOOL_INSTALLATION: entry(false, "1.0.0") }),
    );

    assert_eq!(applied, FlagsApplied::Unchanged);
    assert_eq!(service.awaiting_restart(), None);
    assert_eq!(service.applied_sequence(MACHINE), 2);
}

#[test]
fn a_reported_restart_is_not_reported_again() {
    let (path, _dir) = flags_path();
    let service = load(&path, VERSION);
    apply(
        &service,
        7,
        json!({ TOOL_INSTALLATION: entry(true, "1.0.0") }),
    );

    let restarted = load(&path, VERSION);
    restarted.restart_reported().unwrap();

    assert_eq!(restarted.awaiting_restart(), None);
    let next_start = load(&path, VERSION);
    assert_eq!(next_start.awaiting_restart(), None);
    assert!(tool_installation(&next_start));
}

#[test]
fn a_new_registration_accepts_any_sequence_and_keeps_flags_until_then() {
    let (path, _dir) = flags_path();
    let service = load(&path, VERSION);
    apply(
        &service,
        50,
        json!({ TOOL_INSTALLATION: entry(true, "1.0.0") }),
    );

    let restarted = load(&path, VERSION);

    assert_eq!(restarted.applied_sequence(MACHINE), 50);
    assert_eq!(restarted.applied_sequence("machine-2"), 0);
    assert!(tool_installation(&restarted));
}

#[test]
fn a_file_without_machine_id_accepts_the_first_set() {
    let (path, _dir) = flags_path();
    std::fs::write(
        &path,
        br#"{ "sequence": 9, "flags": { "delivery-tool-installation": { "enabled": true, "minVersion": "1.0.0" } } }"#,
    )
    .unwrap();

    let service = load(&path, VERSION);

    assert!(tool_installation(&service));
    assert_eq!(service.applied_sequence(MACHINE), 0);
}

#[test]
fn the_persisted_state_matches_the_documented_shape() {
    let (path, _dir) = flags_path();
    let service = load(&path, VERSION);

    apply(
        &service,
        42,
        json!({ TOOL_INSTALLATION: entry(true, "1.5.1") }),
    );

    let stored: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    assert_eq!(
        stored,
        json!({
            "machine_id": MACHINE,
            "sequence": 42,
            "flags": { TOOL_INSTALLATION: { "enabled": true, "minVersion": "1.5.1" } },
            "awaiting_restart": {
                "type": "CLIENT_FEATURE_FLAGS",
                "targetId": "tenant",
                "dispatchId": "dispatch-42",
                "sequence": 42
            }
        })
    );
}
