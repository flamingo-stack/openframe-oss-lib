use super::*;

#[test]
fn default_headers_carry_machine_id_version_and_hash() {
    let headers = agent_default_headers("machine-1", Some("abc123")).unwrap();
    assert_eq!(headers[MACHINE_ID_HEADER], "machine-1");
    assert_eq!(headers[AGENT_VERSION_HEADER], env!("OPENFRAME_VERSION"));
    assert_eq!(headers[BINARY_HASH_HEADER], "abc123");
    assert_eq!(headers.len(), 3);
}

#[test]
fn binary_hash_header_is_omitted_without_a_hash() {
    let headers = agent_default_headers("machine-1", None).unwrap();
    assert!(headers.get(BINARY_HASH_HEADER).is_none());
    assert_eq!(headers.len(), 2);
}

#[test]
fn rejects_invalid_header_values() {
    assert!(agent_default_headers("bad\nid", None).is_err());
    assert!(agent_default_headers("machine-1", Some("bad\nhash")).is_err());
}

#[test]
fn builds_a_client_with_and_without_a_hash() {
    let timeout = Duration::from_secs(1);
    assert!(build_agent_http_client("machine-1", Some("abc123"), timeout, false).is_ok());
    assert!(build_agent_http_client("machine-1", None, timeout, false).is_ok());
}
