use super::*;

#[test]
fn writes_sorted_ids_and_removes_on_empty() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(TOOL_OPS_IN_FLIGHT_FILE_NAME);

    write_in_flight_tool_ops(dir.path(), &["meshcentral-agent".to_string()]);
    let raw = std::fs::read_to_string(&path).unwrap();
    let ids: Vec<String> = serde_json::from_str(&raw).unwrap();
    assert_eq!(ids, vec!["meshcentral-agent".to_string()]);
    assert!(!path.with_extension("json.tmp").exists());

    write_in_flight_tool_ops(dir.path(), &[]);
    assert!(!path.exists());
}

#[test]
fn empty_set_without_marker_is_a_noop() {
    let dir = tempfile::tempdir().unwrap();
    write_in_flight_tool_ops(dir.path(), &[]);
    assert!(!dir.path().join(TOOL_OPS_IN_FLIGHT_FILE_NAME).exists());
}
