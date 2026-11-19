use super::*;

fn config(os: &str, min: Option<&str>) -> DownloadConfiguration {
    serde_json::from_value(serde_json::json!({
        "os": os,
        "fileName": "agent.zip",
        "targetFileName": "agent",
        "link": "https://example.invalid/agent.zip",
        "minOsVersion": min,
    }))
    .unwrap()
}

fn shortfall(configs: &[DownloadConfiguration], current: Option<&str>) -> Option<String> {
    let current = current.map(|c| c.parse::<OsVersionNumber>().unwrap());
    os_version_shortfall(configs, current.as_ref())
}

const THIS_OS: &str = std::env::consts::OS;

#[test]
fn below_the_minimum_of_this_os_names_both_versions() {
    let label = match THIS_OS {
        "macos" => "macOS",
        "windows" => "Windows",
        _ => "Linux",
    };
    assert_eq!(
        shortfall(&[config(THIS_OS, Some("13.0"))], Some("11.7.10")),
        Some(format!(
            "needs {label} 13.0 or later, this device runs 11.7.10"
        ))
    );
}

#[test]
fn at_or_above_the_minimum_is_supported() {
    assert_eq!(
        shortfall(&[config(THIS_OS, Some("13.0"))], Some("13")),
        None
    );
    assert_eq!(
        shortfall(&[config(THIS_OS, Some("13.0"))], Some("15.6.1")),
        None
    );
}

#[test]
fn an_unknown_version_or_no_minimum_is_supported() {
    assert_eq!(shortfall(&[config(THIS_OS, Some("13.0"))], None), None);
    assert_eq!(shortfall(&[config(THIS_OS, None)], Some("1.0")), None);
}

#[test]
fn only_the_configuration_for_this_os_counts() {
    let other = if THIS_OS == "windows" {
        "macos"
    } else {
        "windows"
    };
    assert_eq!(shortfall(&[config(other, Some("99.0"))], Some("1.0")), None);
    assert!(shortfall(
        &[config(other, None), config(THIS_OS, Some("99.0"))],
        Some("1.0")
    )
    .is_some());
}

#[test]
fn a_malformed_minimum_fails_the_message() {
    let malformed = serde_json::json!({
        "os": THIS_OS,
        "fileName": "agent.zip",
        "targetFileName": "agent",
        "link": "https://example.invalid/agent.zip",
        "minOsVersion": "13.x",
    });
    assert!(serde_json::from_value::<DownloadConfiguration>(malformed).is_err());
}
