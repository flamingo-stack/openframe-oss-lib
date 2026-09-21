use super::*;

#[test]
fn older_target_is_a_downgrade() {
    assert_eq!(compare_versions("1.3.44", "1.3.41"), Some(Ordering::Less));
    assert_eq!(compare_versions("v1.3.44", "1.3.29"), Some(Ordering::Less));
    assert_eq!(
        compare_versions("1.3.44", "1.3.44-rc.1"),
        Some(Ordering::Less)
    );
}

#[test]
fn newer_target_is_an_upgrade() {
    assert_eq!(
        compare_versions("1.3.41", "1.3.44"),
        Some(Ordering::Greater)
    );
    assert_eq!(
        compare_versions("1.3.44-rc.1", "1.3.44"),
        Some(Ordering::Greater)
    );
    assert_eq!(
        compare_versions("1.3.44", " V1.3.45 "),
        Some(Ordering::Greater)
    );
}

#[test]
fn same_precedence_is_equal_regardless_of_spelling_or_build_metadata() {
    assert_eq!(compare_versions("1.3.44", "1.3.44"), Some(Ordering::Equal));
    assert_eq!(compare_versions("1.3.44", "v1.3.44"), Some(Ordering::Equal));
    assert_eq!(
        compare_versions("1.3.44+b2", "1.3.44+b1"),
        Some(Ordering::Equal)
    );
}

#[test]
fn unparseable_versions_do_not_compare() {
    assert_eq!(parse_version("latest"), None);
    assert_eq!(parse_version("vv1.3.41"), None);
    assert_eq!(parse_version("1.3"), None);
    assert_eq!(compare_versions("latest", "1.3.41"), None);
    assert_eq!(compare_versions("1.3.44", "dev"), None);
    assert_eq!(compare_versions("", "1.3.41"), None);
}
