use super::*;

fn persisted_info() -> PersistedMachineInfo {
    PersistedMachineInfo {
        machine_id: "server-machine-id".to_string(),
        client_secret: "secret".to_string(),
        user_id: None,
    }
}

#[test]
fn fresh_register_sends_local_machine_id_header() {
    let headers = build_register_headers("key", None, Some("local-machine-id")).unwrap();
    assert_eq!(headers.get("X-Machine-Id").unwrap(), "local-machine-id");
    assert_eq!(headers.get("X-Initial-Key").unwrap(), "key");
    assert_eq!(headers.get("Content-Type").unwrap(), "application/json");
    assert!(headers.get("X-Client-Secret").is_none());
}

#[test]
fn fresh_register_without_local_machine_id_omits_header() {
    let headers = build_register_headers("key", None, None).unwrap();
    assert!(headers.get("X-Machine-Id").is_none());
}

#[test]
fn reinstall_sends_server_assigned_credentials() {
    let headers =
        build_register_headers("key", Some(persisted_info()), Some("local-machine-id")).unwrap();
    assert_eq!(headers.get("X-Machine-Id").unwrap(), "server-machine-id");
    assert_eq!(headers.get("X-Client-Secret").unwrap(), "secret");
    assert_eq!(headers.get("X-Initial-Key").unwrap(), "key");
}

#[test]
fn rejects_unparseable_local_machine_id() {
    assert!(build_register_headers("key", None, Some("bad\nid")).is_err());
}

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
