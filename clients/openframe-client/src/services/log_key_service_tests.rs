use super::*;
use crate::models::InitialConfiguration;
use crate::test_support::{directories, mock_server_with_body, registered_agent, wait_until, FAST};
use tokio::task::JoinHandle;

struct Fixture {
    _dir: tempfile::TempDir,
    initial: InitialConfigurationService,
    deactivation: Arc<DeactivationService>,
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
            log_key: log_key.into(),
            ..Default::default()
        })
        .unwrap();
    let agent = registered_agent(&dm).await;
    let deactivation = DeactivationService::new(&dm);
    let mut service = LogKeyService::new(
        reqwest::Client::new(),
        base_url,
        initial.clone(),
        agent,
        deactivation.clone(),
    );
    service.timing = FAST;
    Fixture {
        _dir: dir,
        initial,
        deactivation,
        service: Arc::new(service),
    }
}

fn spawn_run(fx: &Fixture) -> JoinHandle<()> {
    let service = fx.service.clone();
    tokio::spawn(async move { service.run().await })
}

async fn finished(handle: JoinHandle<()>) {
    tokio::time::timeout(Duration::from_secs(5), handle)
        .await
        .expect("run returns once a new key is saved")
        .unwrap();
}

#[tokio::test]
async fn present_key_makes_no_call_until_the_stream_fails_and_drops_the_initial_key() {
    let server = mock_server_with_body(&[200], r#"{"key":"fresh"}"#).await;
    let fx = fixture(server.url.clone(), "existing").await;

    let handle = spawn_run(&fx);
    wait_until(|| fx.initial.get_initial_key().unwrap().is_empty()).await;
    tokio::time::sleep(Duration::from_millis(200)).await;

    assert!(!handle.is_finished());
    assert!(server.requests().is_empty());
    assert_eq!(fx.initial.get_log_key().unwrap(), "existing");
    handle.abort();
}

#[tokio::test]
async fn missing_key_is_fetched_with_the_machine_token_and_saved() {
    let server = mock_server_with_body(&[200], r#"{"key":"fresh"}"#).await;
    let fx = fixture(server.url.clone(), "").await;

    finished(spawn_run(&fx)).await;

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
    assert_eq!(fx.initial.get_log_key().unwrap(), "fresh");
    assert_eq!(fx.initial.get_initial_key().unwrap(), "");
}

#[tokio::test]
async fn failures_are_retried_until_the_key_arrives() {
    let server = mock_server_with_body(&[503, 401, 200], r#"{"key":"fresh"}"#).await;
    let fx = fixture(server.url.clone(), "").await;

    finished(spawn_run(&fx)).await;

    assert_eq!(server.requests().len(), 3);
    assert_eq!(fx.initial.get_log_key().unwrap(), "fresh");
}

#[tokio::test]
async fn an_empty_key_is_not_saved() {
    let server = mock_server_with_body(&[200], r#"{"key":""}"#).await;
    let fx = fixture(server.url.clone(), "").await;

    let handle = spawn_run(&fx);
    tokio::time::sleep(Duration::from_millis(300)).await;

    assert!(!handle.is_finished());
    assert!(server.requests().len() >= 2);
    assert_eq!(fx.initial.get_log_key().unwrap(), "");
    assert_eq!(fx.initial.get_initial_key().unwrap(), "enroll");
    handle.abort();
}

#[tokio::test]
async fn a_failing_stream_picks_up_the_key_the_server_holds() {
    let server = mock_server_with_body(&[200], r#"{"key":"rotated"}"#).await;
    let fx = fixture(server.url.clone(), "existing").await;

    let handle = spawn_run(&fx);
    fx.service.connect_failed();
    finished(handle).await;

    assert_eq!(server.requests().len(), 1);
    assert_eq!(fx.initial.get_log_key().unwrap(), "rotated");
}

#[tokio::test]
async fn the_saved_key_coming_back_needs_no_restart() {
    let server = mock_server_with_body(&[200], r#"{"key":"existing"}"#).await;
    let fx = fixture(server.url.clone(), "existing").await;

    let handle = spawn_run(&fx);
    fx.service.connect_failed();
    wait_until(|| server.requests().len() == 1).await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(server.requests().len(), 1);

    fx.service.connect_failed();
    wait_until(|| server.requests().len() == 2).await;

    assert!(!handle.is_finished());
    assert_eq!(fx.initial.get_log_key().unwrap(), "existing");
    handle.abort();
}

// Suspension only exists where self-uninstall is supported.
#[cfg(any(target_os = "macos", target_os = "windows"))]
#[tokio::test]
async fn nothing_is_fetched_while_the_tenant_is_suspended() {
    let server = mock_server_with_body(&[200], r#"{"key":"rotated"}"#).await;
    let fx = fixture(server.url.clone(), "existing").await;
    for _ in 0..10 {
        fx.deactivation
            .on_gateway_status(reqwest::StatusCode::GONE)
            .await;
    }
    assert!(fx.deactivation.is_suspended());

    let handle = spawn_run(&fx);
    fx.service.connect_failed();
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert!(server.requests().is_empty());

    fx.deactivation
        .on_gateway_status(reqwest::StatusCode::OK)
        .await;
    finished(handle).await;
    assert_eq!(server.requests().len(), 1);
    assert_eq!(fx.initial.get_log_key().unwrap(), "rotated");
}
