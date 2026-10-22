use super::*;
use crate::models::InitialConfiguration;
use crate::test_support::{directories, mock_server_with_body, registered_agent, FAST};

struct Fixture {
    _dir: tempfile::TempDir,
    initial: InitialConfigurationService,
    service: Arc<InitialKeyService>,
}

async fn fixture(base_url: String, initial_key: &str) -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let initial = InitialConfigurationService::new(dm.clone()).unwrap();
    initial
        .save(&InitialConfiguration {
            server_host: "acme.openframe.ai".into(),
            initial_key: initial_key.into(),
            ..Default::default()
        })
        .unwrap();
    let mut service = InitialKeyService::new(
        reqwest::Client::new(),
        base_url,
        initial.clone(),
        registered_agent(&dm).await,
        DeactivationService::new(&dm),
    );
    service.timing = FAST;
    Fixture {
        _dir: dir,
        initial,
        service: Arc::new(service),
    }
}

async fn run_to_completion(fx: &Fixture) {
    let handle = fx
        .service
        .clone()
        .start()
        .expect("a missing key starts a task");
    tokio::time::timeout(Duration::from_secs(5), handle)
        .await
        .expect("the task saves the key")
        .unwrap();
}

#[tokio::test]
async fn present_key_makes_no_call() {
    let server = mock_server_with_body(&[200], r#"{"key":"fresh"}"#).await;
    let fx = fixture(server.url.clone(), "existing").await;

    assert!(fx.service.clone().start().is_none());
    assert!(server.requests().is_empty());
    assert_eq!(fx.initial.get_initial_key().unwrap(), "existing");
}

#[tokio::test]
async fn missing_key_is_fetched_with_the_machine_token_and_saved() {
    let server = mock_server_with_body(&[200], r#"{"key":"fresh"}"#).await;
    let fx = fixture(server.url.clone(), "").await;

    run_to_completion(&fx).await;

    let requests = server.requests();
    assert_eq!(requests.len(), 1);
    assert_eq!(
        requests[0].request_line,
        "GET /clients/agent/registration-secret/active HTTP/1.1"
    );
    assert!(requests[0]
        .head
        .to_ascii_lowercase()
        .contains("authorization: bearer machine-token"));
    assert_eq!(fx.initial.get_initial_key().unwrap(), "fresh");
}

#[tokio::test]
async fn failures_are_retried_until_the_key_arrives() {
    let server = mock_server_with_body(&[503, 401, 200], r#"{"key":"fresh"}"#).await;
    let fx = fixture(server.url.clone(), "").await;

    run_to_completion(&fx).await;

    assert_eq!(server.requests().len(), 3);
    assert_eq!(fx.initial.get_initial_key().unwrap(), "fresh");
}
