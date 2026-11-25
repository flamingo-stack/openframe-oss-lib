use super::*;

fn parse(os: &str, min: serde_json::Value) -> serde_json::Result<DownloadConfiguration> {
    serde_json::from_value(serde_json::json!({
        "os": os,
        "fileName": "agent.zip",
        "targetFileName": "agent",
        "link": "https://example.invalid/agent.zip",
        "minOsVersion": min,
    }))
}

#[test]
fn a_dotted_minimum_is_kept() {
    let config = parse("macos", "13.0".into()).unwrap();
    assert_eq!(
        config.min_os_version.map(|v| v.to_string()),
        Some("13.0".to_string())
    );
}

#[test]
fn a_missing_null_blank_or_unparsable_minimum_reads_as_no_minimum() {
    for min in [
        serde_json::Value::Null,
        "".into(),
        "  ".into(),
        "13.0-beta".into(),
        "13.x".into(),
    ] {
        let config = parse("macos", min.clone()).unwrap();
        assert!(config.min_os_version.is_none(), "{min}");
    }
}

#[test]
fn a_bad_minimum_on_another_os_keeps_the_whole_list() {
    let configs: Vec<DownloadConfiguration> = serde_json::from_value(serde_json::json!([
        {
            "os": "windows",
            "fileName": "agent.zip",
            "targetFileName": "agent",
            "link": "https://example.invalid/agent.zip",
            "minOsVersion": "",
        },
        {
            "os": "macos",
            "fileName": "agent.zip",
            "targetFileName": "agent",
            "link": "https://example.invalid/agent.zip",
            "minOsVersion": "13.0",
        },
    ]))
    .unwrap();
    assert!(configs[0].min_os_version.is_none());
    assert!(configs[1].min_os_version.is_some());
}
