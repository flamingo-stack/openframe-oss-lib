use super::*;
use crate::test_support::mock_server;

const HASH: &str = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

fn header<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).map(|value| value.to_str().unwrap())
}

#[test]
fn identity_headers_carry_machine_id_version_and_hash() {
    let headers = identity_headers("machine-1", "1.5.74", Some(HASH)).unwrap();

    assert_eq!(header(&headers, MACHINE_ID_HEADER), Some("machine-1"));
    assert_eq!(header(&headers, AGENT_VERSION_HEADER), Some("1.5.74"));
    assert_eq!(header(&headers, BINARY_HASH_HEADER), Some(HASH));
    assert_eq!(headers.len(), 3);
}

#[test]
fn missing_hash_only_drops_its_header() {
    let headers = identity_headers("machine-1", "0.0.0-dev", None).unwrap();

    assert_eq!(header(&headers, MACHINE_ID_HEADER), Some("machine-1"));
    assert_eq!(header(&headers, AGENT_VERSION_HEADER), Some("0.0.0-dev"));
    assert!(headers.get(BINARY_HASH_HEADER).is_none());
}

#[test]
fn invalid_optional_values_are_dropped_not_fatal() {
    let headers = identity_headers("machine-1", "1.0\n", Some("bad\u{7f}hash")).unwrap();

    assert_eq!(header(&headers, MACHINE_ID_HEADER), Some("machine-1"));
    assert!(headers.get(AGENT_VERSION_HEADER).is_none());
    assert!(headers.get(BINARY_HASH_HEADER).is_none());
}

#[test]
fn empty_or_invalid_machine_id_is_rejected() {
    assert!(identity_headers("", "1.0", None).is_err());
    assert!(identity_headers("  ", "1.0", None).is_err());
    assert!(identity_headers("bad\nid", "1.0", None).is_err());
}

#[tokio::test]
async fn every_request_carries_the_identity_headers() {
    let server = mock_server(&[200]).await;
    let client =
        build_agent_http_client("local-id", Some(HASH), Duration::from_secs(5), false).unwrap();

    client
        .get(format!("{}/anything", server.url))
        .send()
        .await
        .unwrap();

    let requests = server.requests();
    assert_eq!(requests.len(), 1);
    let head = requests[0].head.to_ascii_lowercase();
    assert!(head.contains("x-machine-id: local-id"), "{head}");
    assert!(
        head.contains(&format!(
            "x-agent-version: {}",
            env!("OPENFRAME_VERSION").to_ascii_lowercase()
        )),
        "{head}"
    );
    assert!(head.contains(&format!("x-binary-hash: {HASH}")), "{head}");
}

#[tokio::test]
async fn a_per_request_machine_id_replaces_the_default_one() {
    let server = mock_server(&[200]).await;
    let client =
        build_agent_http_client("local-id", Some(HASH), Duration::from_secs(5), false).unwrap();

    client
        .post(format!("{}/clients/api/agents/uninstall", server.url))
        .header("X-Machine-Id", "server-id")
        .send()
        .await
        .unwrap();

    let head = server.requests()[0].head.to_ascii_lowercase();
    assert!(head.contains("x-machine-id: server-id"), "{head}");
    assert!(!head.contains("local-id"), "{head}");
    assert!(head.contains(&format!("x-binary-hash: {HASH}")), "{head}");
}
