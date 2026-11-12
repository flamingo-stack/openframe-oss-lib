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
fn a_stored_log_key_wins_over_the_initial_key() {
    assert_eq!(
        choose_key(Some("log".into()), Some("enroll".into())),
        Some(LogStreamKey::Log("log".into()))
    );
    assert_eq!(
        choose_key(Some(String::new()), Some("enroll".into())),
        Some(LogStreamKey::Initial("enroll".into()))
    );
    assert_eq!(
        choose_key(None, Some("enroll".into())),
        Some(LogStreamKey::Initial("enroll".into()))
    );
    assert_eq!(choose_key(Some(String::new()), Some(String::new())), None);
    assert_eq!(choose_key(None, None), None);
}

#[test]
fn only_a_401_on_the_handshake_counts_as_a_key_rejection() {
    let rejected = |text: &str| is_key_rejection(&async_nats::ClientError::Other(text.into()));

    assert!(rejected(
        "authorization violation: expected HTTP 101 Switching Protocols, got status code 401"
    ));
    assert!(!rejected(
        "authorization violation: nats: authorization violation"
    ));
    assert!(!rejected("IO error"));
    assert!(!is_key_rejection(&async_nats::ClientError::MaxReconnects));
}

#[tokio::test]
async fn a_401_on_the_websocket_handshake_reaches_the_event_callback_as_a_key_rejection() {
    let server = crate::test_support::mock_server_with_body(&[401], "").await;
    let (tx, mut rx) = mpsc::unbounded_channel();
    let _client = async_nats::ConnectOptions::new()
        .retry_on_initial_connect()
        .event_callback(move |event| {
            let tx = tx.clone();
            async move {
                if let async_nats::Event::ClientError(err) = event {
                    let _ = tx.send(err);
                }
            }
        })
        .connect(server.url.replace("http://", "ws://").as_str())
        .await
        .unwrap();

    let err = tokio::time::timeout(Duration::from_secs(10), rx.recv())
        .await
        .expect("a client error within the deadline")
        .unwrap();
    assert!(is_key_rejection(&err), "{err}");
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
