use super::*;

fn probe(dir: &std::path::Path) -> ClientToolOpProbe {
    ClientToolOpProbe::from_path(dir.join("tool_ops_in_flight.json"))
}

#[test]
fn no_marker_means_no_ops() {
    let dir = tempfile::tempdir().unwrap();
    assert!(probe(dir.path()).in_flight_tool_ops().is_empty());
}

#[test]
fn reads_tool_ids_from_marker() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(
        dir.path().join("tool_ops_in_flight.json"),
        r#"["meshcentral-agent","fleetmdm-agent"]"#,
    )
    .unwrap();
    assert_eq!(
        probe(dir.path()).in_flight_tool_ops(),
        vec![
            "meshcentral-agent".to_string(),
            "fleetmdm-agent".to_string()
        ]
    );
}

#[test]
fn unreadable_marker_is_ignored() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("tool_ops_in_flight.json"), "{not json").unwrap();
    assert!(probe(dir.path()).in_flight_tool_ops().is_empty());
}

#[tokio::test]
async fn quiescence_returns_immediately_when_idle() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("tool_ops_in_flight.json"), "[]").unwrap();
    assert!(probe(dir.path()).wait_for_quiescence().await.is_ok());
}
