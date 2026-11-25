use super::*;

fn os(version: Option<&str>, build: &str) -> OsVersion {
    OsVersion {
        version: version.map(|v| v.parse().unwrap()),
        build: build.to_string(),
    }
}

#[test]
fn sw_vers_output_becomes_version_and_build() {
    let output = "ProductName:\t\tmacOS\nProductVersion:\t\t15.6.1\nBuildVersion:\t\t24G90\n";
    assert_eq!(parse_sw_vers(output), os(Some("15.6.1"), "24G90"));
}

#[test]
fn sw_vers_rapid_security_response_keeps_the_plain_version() {
    let output = "ProductName:\t\tmacOS\nProductVersion:\t\t13.3.1\nProductVersionExtra:\t\t(a)\nBuildVersion:\t\t22E772610a\n";
    assert_eq!(parse_sw_vers(output), os(Some("13.3.1"), "22E772610a"));
}

#[test]
fn sw_vers_product_version_that_is_not_a_number_has_no_version() {
    let output = "ProductVersion:\t\t26.0 beta\nBuildVersion:\t\t25A5279m\n";
    assert_eq!(parse_sw_vers(output), os(None, "25A5279m"));
}

#[test]
fn sw_vers_garbage_yields_empty_fields() {
    assert_eq!(parse_sw_vers(""), OsVersion::default());
    assert_eq!(parse_sw_vers("no colons here\n"), OsVersion::default());
    assert_eq!(
        parse_sw_vers("ProductVersion:\nBuildVersion:\n"),
        OsVersion::default()
    );
}

#[test]
fn windows_version_is_kernel_version_and_build_number() {
    assert_eq!(
        windows_version(Some((10, 0)), "22631", Some(3007)),
        os(Some("10.0.22631"), "22631.3007")
    );
}

#[test]
fn windows_without_kernel_version_or_ubr_reports_what_it_has() {
    assert_eq!(windows_version(None, "17763", None), os(None, "17763"));
}

#[test]
fn windows_unparseable_build_number_has_no_version() {
    assert_eq!(windows_version(Some((10, 0)), "", Some(1)), os(None, "1"));
    assert_eq!(
        windows_version(Some((10, 0)), " abc ", None),
        os(None, "abc")
    );
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
#[test]
fn detect_reports_the_running_os() {
    let detected = detect();
    assert!(detected.version.is_some(), "{detected:?}");
    assert!(!detected.build.is_empty(), "{detected:?}");
}
