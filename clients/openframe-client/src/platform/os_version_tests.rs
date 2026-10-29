use super::*;

const SW_VERS_SEQUOIA: &str =
    "ProductName:\t\tmacOS\nProductVersion:\t\t15.6.1\nBuildVersion:\t\t24G90\n";

fn os(version: &str, build: &str) -> OsVersion {
    OsVersion {
        version: version.to_string(),
        build: build.to_string(),
    }
}

#[test]
fn sw_vers_output_becomes_name_version_and_build() {
    assert_eq!(parse_sw_vers(SW_VERS_SEQUOIA), os("macOS 15.6.1", "24G90"));
}

#[test]
fn sw_vers_rapid_security_response_suffix_is_kept() {
    let output = "ProductName:\t\tmacOS\nProductVersion:\t\t13.3.1\nProductVersionExtra:\t\t(a)\nBuildVersion:\t\t22E772610a\n";
    assert_eq!(parse_sw_vers(output), os("macOS 13.3.1 (a)", "22E772610a"));
}

#[test]
fn sw_vers_without_product_name_defaults_to_macos() {
    let output = "ProductVersion: 14.2\nBuildVersion: 23C64\n";
    assert_eq!(parse_sw_vers(output), os("macOS 14.2", "23C64"));
}

#[test]
fn sw_vers_garbage_yields_empty_fields() {
    assert_eq!(parse_sw_vers(""), OsVersion::default());
    assert_eq!(parse_sw_vers("no colons here\n"), OsVersion::default());
    assert_eq!(
        parse_sw_vers("ProductName:\nBuildVersion:\n"),
        OsVersion::default()
    );
}

#[test]
fn windows_11_is_recognised_by_build_number() {
    assert_eq!(
        windows_version("Windows 10 Pro", Some("23H2"), "22631", Some(3007)),
        os("Windows 11 Pro 23H2", "22631.3007")
    );
}

#[test]
fn windows_10_keeps_its_name_below_build_22000() {
    assert_eq!(
        windows_version("Windows 10 Enterprise", Some("22H2"), "19045", Some(4291)),
        os("Windows 10 Enterprise 22H2", "19045.4291")
    );
}

#[test]
fn windows_server_name_is_left_alone() {
    assert_eq!(
        windows_version(
            "Windows Server 2022 Datacenter",
            Some("21H2"),
            "20348",
            Some(2529)
        ),
        os("Windows Server 2022 Datacenter 21H2", "20348.2529")
    );
}

#[test]
fn windows_without_display_version_or_ubr_degrades_gracefully() {
    assert_eq!(
        windows_version("Windows 10 Pro", None, "17763", None),
        os("Windows 10 Pro", "17763")
    );
}

#[test]
fn windows_unparseable_build_number_keeps_the_product_name() {
    assert_eq!(
        windows_version("Windows 10 Pro", Some("23H2"), "", Some(1)),
        os("Windows 10 Pro 23H2", "1")
    );
    assert_eq!(
        windows_version(" Windows 10 Pro ", Some(" "), "abc", None),
        os("Windows 10 Pro", "abc")
    );
}

#[test]
fn windows_missing_product_name_still_reports_what_it_has() {
    assert_eq!(
        windows_version("", Some("24H2"), "26100", Some(2314)),
        os("24H2", "26100.2314")
    );
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
#[test]
fn detect_reports_the_running_os() {
    let detected = detect();
    assert!(!detected.version.is_empty(), "{detected:?}");
    assert!(!detected.build.is_empty(), "{detected:?}");
    if cfg!(target_os = "macos") {
        assert!(detected.version.starts_with("macOS "), "{detected:?}");
    } else {
        assert!(detected.version.starts_with("Windows "), "{detected:?}");
    }
}
