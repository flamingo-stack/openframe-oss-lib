use super::*;

#[test]
fn detects_client_secret_invalid() {
    let body = r#"{"code":"CLIENT_SECRET_INVALID","message":"Invalid client secret"}"#;
    assert!(is_client_secret_error(StatusCode::UNAUTHORIZED, body));
}

#[test]
fn detects_client_secret_empty() {
    let body = r#"{"code":"CLIENT_SECRET_EMPTY","message":"Client secret is empty"}"#;
    assert!(is_client_secret_error(StatusCode::UNAUTHORIZED, body));
}

#[test]
fn ignores_other_401_error_codes() {
    let body = r#"{"code":"INITIAL_KEY_INVALID","message":"..."}"#;
    assert!(!is_client_secret_error(StatusCode::UNAUTHORIZED, body));
}

#[test]
fn ignores_client_secret_error_on_non_401() {
    let body = r#"{"code":"CLIENT_SECRET_INVALID"}"#;
    assert!(!is_client_secret_error(StatusCode::BAD_REQUEST, body));
}

#[test]
fn handles_non_json_body() {
    assert!(!is_client_secret_error(
        StatusCode::UNAUTHORIZED,
        "gateway timeout"
    ));
}

#[test]
fn terminal_statuses_are_already_gone() {
    for status in [
        StatusCode::UNAUTHORIZED,
        StatusCode::FORBIDDEN,
        StatusCode::NOT_FOUND,
        StatusCode::GONE,
    ] {
        assert!(is_already_gone(status), "{status} should be terminal");
    }
}

#[test]
fn transient_statuses_are_not_already_gone() {
    for status in [
        StatusCode::BAD_REQUEST,
        StatusCode::TOO_MANY_REQUESTS,
        StatusCode::INTERNAL_SERVER_ERROR,
        StatusCode::BAD_GATEWAY,
        StatusCode::SERVICE_UNAVAILABLE,
    ] {
        assert!(!is_already_gone(status), "{status} should be retried");
    }
}

fn current_machine() -> PersistedMachineInfo {
    PersistedMachineInfo {
        machine_id: "m-1".into(),
        client_secret: "secret-1".into(),
        user_id: None,
    }
}

fn split_request() -> IdentitySplitMessage {
    IdentitySplitMessage {
        session_id: "s-1".into(),
    }
}

#[tokio::test]
async fn split_authenticates_as_the_shared_machine_and_names_the_session() {
    let server = crate::test_support::mock_server_with_body(
        &[200],
        r#"{"machineId":"m-2","clientId":"client-2","clientSecret":"secret-2"}"#,
    )
    .await;
    let client = RegistrationClient::new(server.url.clone(), Client::new()).unwrap();

    let response = client
        .split(&current_machine(), &split_request())
        .await
        .unwrap();

    assert_eq!(response.machine_id, "m-2");
    assert_eq!(response.client_id, "client-2");
    assert_eq!(response.client_secret, "secret-2");
    let request = &server.requests()[0];
    assert_eq!(
        request.request_line,
        "POST /clients/api/agents/split HTTP/1.1"
    );
    let head = request.head.to_ascii_lowercase();
    assert!(head.contains("x-machine-id: m-1"));
    assert!(head.contains("x-client-secret: secret-1"));
    assert_eq!(request.body, r#"{"sessionId":"s-1"}"#);
}

#[tokio::test]
async fn a_refused_split_is_an_error() {
    let server = crate::test_support::mock_server_with_body(&[409], "already split").await;
    let client = RegistrationClient::new(server.url.clone(), Client::new()).unwrap();

    let err = client
        .split(&current_machine(), &split_request())
        .await
        .unwrap_err();

    assert!(err.to_string().contains("409"));
}
