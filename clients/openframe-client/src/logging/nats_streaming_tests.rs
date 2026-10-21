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

#[test]
fn a_different_key_on_disk_replaces_a_rejected_one_without_a_fetch() {
    let current = LogStreamKey::Initial("enroll".into());
    assert_eq!(
        replacement_for(&current, true, Some(LogStreamKey::Log("fresh".into()))),
        Replacement::Use(LogStreamKey::Log("fresh".into()))
    );
}

#[test]
fn a_rejected_key_that_is_still_on_disk_is_fetched_again() {
    let current = LogStreamKey::Log("stale".into());
    assert_eq!(
        replacement_for(&current, true, Some(current.clone())),
        Replacement::Fetch
    );
    assert_eq!(replacement_for(&current, true, None), Replacement::Fetch);
}

#[test]
fn an_exhausted_client_is_rebuilt_with_the_key_on_disk() {
    let current = LogStreamKey::Log("k".into());
    assert_eq!(
        replacement_for(&current, false, Some(current.clone())),
        Replacement::Use(current.clone())
    );
    assert_eq!(replacement_for(&current, false, None), Replacement::Keep);
}

#[test]
fn connection_state_follows_the_client_events() {
    let state = ConnectionState::default();
    state.on_event(&async_nats::Event::ClientError(
        async_nats::ClientError::Other("authorization violation: status code 401".into()),
    ));
    assert!(state.key_rejected.load(Ordering::Relaxed));
    assert!(!state.connected.load(Ordering::Relaxed));

    state.on_event(&async_nats::Event::Connected);
    assert!(!state.key_rejected.load(Ordering::Relaxed));
    assert!(state.connected.load(Ordering::Relaxed));

    state.on_event(&async_nats::Event::Disconnected);
    assert!(!state.connected.load(Ordering::Relaxed));

    state.on_event(&async_nats::Event::ClientError(
        async_nats::ClientError::MaxReconnects,
    ));
    assert!(state.exhausted.load(Ordering::Relaxed));
}
