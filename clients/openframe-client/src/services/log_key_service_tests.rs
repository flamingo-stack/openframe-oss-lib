use super::*;
use crate::models::InitialConfiguration;
use crate::test_support::{directories, mock_server_with_body, registered_agent, FAST};

struct Fixture {
    _dir: tempfile::TempDir,
    initial: InitialConfigurationService,
    agent: AgentConfigurationService,
    service: Arc<LogKeyService>,
}

async fn fixture(base_url: String, log_key: &str) -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let initial = InitialConfigurationService::new(dm.clone()).unwrap();
    initial
        .save(&InitialConfiguration {
            server_host: "acme.openframe.ai".into(),
            initial_key: "enroll".into(),
            ..Default::default()
        })
        .unwrap();
    let agent = registered_agent(&dm).await;
    if !log_key.is_empty() {
        agent.save_log_key(log_key.into()).await.unwrap();
    }
    let mut service = LogKeyService::new(
        reqwest::Client::new(),
        base_url,
        initial.clone(),
        agent.clone(),
        DeactivationService::new(&dm),
    );
    service.timing = FAST;
    Fixture {
        _dir: dir,
        initial,
        agent,
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
async fn present_key_makes_no_call_and_keeps_the_initial_key() {
    let server = mock_server_with_body(&[200], r#"{"key":"fresh"}"#).await;
    let fx = fixture(server.url.clone(), "existing").await;

    assert!(fx.service.clone().start().is_none());
    assert!(server.requests().is_empty());
    assert_eq!(fx.agent.get_log_key().unwrap(), "existing");
    assert_eq!(fx.initial.get_initial_key().unwrap(), "enroll");
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
        "GET /clients/agent/log-key HTTP/1.1"
    );
    assert!(requests[0]
        .head
        .to_ascii_lowercase()
        .contains("authorization: bearer machine-token"));
    assert_eq!(fx.agent.get_log_key().unwrap(), "fresh");
    assert_eq!(fx.initial.get_initial_key().unwrap(), "");
}

#[tokio::test]
async fn failures_are_retried_until_the_key_arrives() {
    let server = mock_server_with_body(&[503, 401, 200], r#"{"key":"fresh"}"#).await;
    let fx = fixture(server.url.clone(), "").await;

    run_to_completion(&fx).await;

    assert_eq!(server.requests().len(), 3);
    assert_eq!(fx.agent.get_log_key().unwrap(), "fresh");
}

#[tokio::test]
async fn an_empty_key_is_not_saved() {
    let server = mock_server_with_body(&[200], r#"{"key":""}"#).await;
    let fx = fixture(server.url.clone(), "").await;

    let handle = fx.service.clone().start().unwrap();
    tokio::time::sleep(Duration::from_millis(300)).await;

    assert!(!handle.is_finished());
    assert!(server.requests().len() >= 2);
    assert_eq!(fx.agent.get_log_key().unwrap(), "");
    assert_eq!(fx.initial.get_initial_key().unwrap(), "enroll");
    handle.abort();
}
