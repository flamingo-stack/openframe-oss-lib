use super::nats_ws_url;

/// The regression this guards: a bearer token in the query string is written verbatim into every
/// load-balancer access log. It belongs in the `Authorization` handshake header, never in the URL.
#[test]
fn connection_url_carries_no_credential() {
    let url = nats_ws_url("wss://tenant.openframe.ai");
    assert_eq!(url, "wss://tenant.openframe.ai/ws/nats");
    assert!(!url.contains("authorization"), "{url}");
    assert!(!url.contains('?'), "{url}");
}

#[test]
fn connection_url_preserves_the_configured_host() {
    assert_eq!(
        nats_ws_url("ws://localhost:8080"),
        "ws://localhost:8080/ws/nats"
    );
}
