use super::*;

#[test]
fn windows_11_is_detected_from_the_build_number() {
    assert_eq!(
        windows_version("Windows 10 Pro", Some("24H2"), "26100"),
        "Windows 11 Pro 24H2"
    );
}

#[test]
fn windows_10_keeps_its_product_name() {
    assert_eq!(
        windows_version("Windows 10 Enterprise", Some("22H2"), "19045"),
        "Windows 10 Enterprise 22H2"
    );
}

#[test]
fn windows_server_name_is_untouched() {
    assert_eq!(
        windows_version("Windows Server 2025 Datacenter", None, "26100"),
        "Windows Server 2025 Datacenter"
    );
}

#[test]
fn empty_display_version_is_skipped() {
    assert_eq!(
        windows_version("Windows 10 Pro ", Some(" "), "19041"),
        "Windows 10 Pro"
    );
}

#[test]
fn windows_build_appends_ubr_when_present() {
    assert_eq!(windows_build("26100", Some(4652)), "26100.4652");
    assert_eq!(windows_build("26100", None), "26100");
}

fn is_dotted_digits(value: &str) -> bool {
    value
        .split('.')
        .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
}

#[cfg(target_os = "macos")]
#[test]
fn detects_macos_version_and_build() {
    let os = detect();
    let version = os.version.expect("macOS version");
    let number = version.strip_prefix("macOS ").expect("macOS prefix");
    assert!(is_dotted_digits(number), "{version}");
    let build = os.build.expect("macOS build");
    assert!(
        build.len() >= 4 && build.chars().all(|c| c.is_ascii_alphanumeric()),
        "{build}"
    );
}

#[cfg(windows)]
#[test]
fn detects_windows_version_and_build() {
    let os = detect();
    let version = os.version.expect("Windows version");
    assert!(version.starts_with("Windows "), "{version}");
    let build = os.build.expect("Windows build");
    assert!(is_dotted_digits(&build), "{build}");
}

#[cfg(not(any(target_os = "macos", windows)))]
#[test]
fn other_platforms_report_nothing() {
    assert_eq!(detect(), OsVersion::default());
}
