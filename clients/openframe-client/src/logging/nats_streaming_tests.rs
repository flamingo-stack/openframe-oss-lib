use super::*;

#[test]
fn each_key_kind_uses_its_own_header() {
    assert_eq!(LogStreamKey::Log("k1".into()).header(), ("x-log-key", "k1"));
    assert_eq!(
        LogStreamKey::Initial("k2".into()).header(),
        ("x-initial-key", "k2")
    );
}

#[test]
fn only_an_authorization_violation_counts_as_a_rejected_key() {
    assert!(is_authorization_error(
        "nats: authorization violation: WebSocket handshake failed: status code 401"
    ));
    assert!(!is_authorization_error("nats: I/O error"));
    assert!(!is_authorization_error("nats: max reconnects reached"));
}

#[test]
fn tenant_domain_drops_the_api_prefix() {
    assert_eq!(
        extract_tenant_domain("api.acme.openframe.ai"),
        "acme.openframe.ai"
    );
    assert_eq!(
        extract_tenant_domain("acme.openframe.ai"),
        "acme.openframe.ai"
    );
}
