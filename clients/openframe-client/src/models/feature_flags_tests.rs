use super::*;

const TOOL_INSTALLATION: &str = "delivery-tool-installation";

fn flag(value: bool, min_version: &str) -> FeatureFlag {
    FeatureFlag {
        enabled: value,
        min_version: min_version.to_string(),
    }
}

fn resolve(entries: &[(&str, FeatureFlag)], running_version: &str) -> FeatureFlags {
    let flags = entries
        .iter()
        .map(|(name, flag)| (name.to_string(), flag.clone()))
        .collect();
    FeatureFlags::resolve(&flags, running_version)
}

#[test]
fn a_flag_applies_only_from_its_min_version() {
    let cases = [
        (true, "1.5.1", "1.5.1", true, "same version"),
        (true, "1.5.1", "1.5.2", true, "newer patch"),
        (true, "1.5.1", "1.6.0", true, "newer minor"),
        (true, "1.5.1", "2.0.0", true, "newer major"),
        (true, "1.5.1", "1.5.0", false, "older patch"),
        (true, "1.5.1", "1.4.9", false, "older minor"),
        (true, "1.5.1", "0.9.9", false, "older major"),
        (
            false,
            "1.5.1",
            "2.0.0",
            false,
            "switched off on a supporting version",
        ),
        (
            false,
            "1.5.1",
            "1.0.0",
            false,
            "switched off below the min version",
        ),
        (
            true,
            "1.5.1",
            "1.5.1-rc.1",
            false,
            "a pre-release is below its release",
        ),
        (
            true,
            "1.5.1-rc.1",
            "1.5.1-rc.2",
            true,
            "a later pre-release",
        ),
        (
            true,
            "1.5.1-rc.2",
            "1.5.1-rc.1",
            false,
            "an earlier pre-release",
        ),
        (
            true,
            "1.5.1-rc.1",
            "1.5.1",
            true,
            "a release is above its pre-release",
        ),
        (
            true,
            "1.5.1",
            "1.5.1+build.7",
            true,
            "build metadata carries no order",
        ),
        (
            true,
            "v1.5.1",
            "1.5.1",
            true,
            "a v prefix on the min version",
        ),
        (
            true,
            " 1.5.1 ",
            "1.5.1",
            true,
            "whitespace around the min version",
        ),
        (
            true,
            "latest",
            "2.0.0",
            false,
            "a min version that is not semver",
        ),
        (true, "", "2.0.0", false, "an empty min version"),
        (
            true,
            "1.5.1",
            "not-a-version",
            false,
            "a running version that is not semver",
        ),
    ];
    for (value, min_version, running, expected, why) in cases {
        let flags = resolve(&[(TOOL_INSTALLATION, flag(value, min_version))], running);

        assert_eq!(
            flags.is_enabled(Feature::DeliveryToolInstallation),
            expected,
            "{why}: value={value} minVersion={min_version:?} running={running:?}"
        );
    }
}

#[test]
fn the_dev_build_takes_the_value_whatever_the_min_version() {
    let cases = [
        (true, "99.0.0", true),
        (true, "latest", true),
        (true, "0.0.1", true),
        (false, "0.0.1", false),
        (false, "99.0.0", false),
    ];
    for (value, min_version, expected) in cases {
        let flags = resolve(
            &[(TOOL_INSTALLATION, flag(value, min_version))],
            DEV_CLIENT_VERSION,
        );

        assert_eq!(
            flags.is_enabled(Feature::DeliveryToolInstallation),
            expected,
            "value={value} minVersion={min_version:?}"
        );
    }
}

#[test]
fn a_flag_that_does_not_apply_falls_back_to_the_feature_default() {
    let below = flag(false, "2.0.0");
    let above = flag(false, "1.0.0");

    assert!(below.effective("1.5.1", true));
    assert!(!below.effective("1.5.1", false));
    assert!(!above.effective("1.5.1", true));
}

#[test]
fn a_missing_flag_resolves_to_the_default() {
    let flags = resolve(&[], "1.5.1");

    for feature in Feature::ALL {
        assert_eq!(
            flags.is_enabled(feature),
            feature.default_enabled(),
            "{}",
            feature.name()
        );
    }
}

#[test]
fn each_backend_name_switches_only_its_own_feature() {
    for feature in Feature::ALL {
        let flags = resolve(&[(feature.name(), flag(true, "1.0.0"))], "1.5.1");

        for other in Feature::ALL {
            assert_eq!(
                flags.is_enabled(other),
                other == feature,
                "{} set, {} checked",
                feature.name(),
                other.name()
            );
        }
    }
}

#[test]
fn unknown_flags_do_not_touch_known_features() {
    let with_unknown = resolve(
        &[
            ("future-feature", flag(true, "1.0.0")),
            (TOOL_INSTALLATION, flag(true, "1.0.0")),
        ],
        "1.5.1",
    );
    let without = resolve(&[(TOOL_INSTALLATION, flag(true, "1.0.0"))], "1.5.1");

    assert_eq!(with_unknown, without);
}

#[test]
fn flag_entries_use_the_backend_field_names() {
    let parsed: FeatureFlag =
        serde_json::from_value(serde_json::json!({ "enabled": true, "minVersion": "1.5.1" }))
            .unwrap();

    assert_eq!(parsed, flag(true, "1.5.1"));
    assert_eq!(
        serde_json::to_value(&parsed).unwrap(),
        serde_json::json!({ "enabled": true, "minVersion": "1.5.1" })
    );
}
