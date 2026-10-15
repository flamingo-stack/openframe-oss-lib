use super::*;
use crate::models::InitialConfiguration;
use crate::test_support::{directories, mock_server, registered_agent, wait_until, FAST};
use std::sync::Mutex;
use tokio::net::TcpListener;

struct Fixture {
    _dir: tempfile::TempDir,
    initial: InitialConfigurationService,
    deactivation: Arc<DeactivationService>,
    service: Arc<RemoteAccessModeService>,
}

async fn fixture(base_url: String, pending: Option<&str>) -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let dm = directories(&dir);
    let initial = InitialConfigurationService::new(dm.clone()).unwrap();
    initial
        .save(&InitialConfiguration {
            server_host: "acme.openframe.ai".into(),
            remote_access_mode: pending.map(str::to_string),
            ..Default::default()
        })
        .unwrap();
    let deactivation = DeactivationService::new(&dm);
    let mut service = RemoteAccessModeService::new(
        RemoteAccessClient::new(
            reqwest::Client::new(),
            base_url,
            registered_agent(&dm).await,
        ),
        initial.clone(),
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

async fn run_to_completion(fx: &Fixture) {
    let handle = fx
        .service
        .clone()
        .start()
        .expect("a pending mode starts a task");
    tokio::time::timeout(Duration::from_secs(5), handle)
        .await
        .expect("the task settles the pending mode")
        .unwrap();
}

#[tokio::test]
async fn no_pending_mode_makes_no_call() {
    let server = mock_server(&[200]).await;
    let fx = fixture(server.url.clone(), None).await;

    assert!(fx.service.clone().start().is_none());
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(server.requests().is_empty());
}

#[tokio::test]
async fn unknown_pending_mode_is_dropped_without_a_call() {
    let server = mock_server(&[200]).await;
    let fx = fixture(server.url.clone(), Some("ALLOW")).await;

    assert!(fx.service.clone().start().is_none());
    assert!(server.requests().is_empty());
    assert_eq!(fx.initial.get_remote_access_mode().unwrap(), None);
}

#[tokio::test]
async fn sends_the_mode_with_the_machine_token_and_clears_it() {
    let server = mock_server(&[200]).await;
    let fx = fixture(server.url.clone(), Some("SILENT_ACCESS")).await;

    run_to_completion(&fx).await;

    let requests = server.requests();
    assert_eq!(requests.len(), 1);
    assert_eq!(
        requests[0].request_line,
        "PUT /clients/api/v1/remote-access/device-mode HTTP/1.1"
    );
    assert!(requests[0]
        .head
        .to_ascii_lowercase()
        .contains("authorization: bearer machine-token"));
    assert_eq!(requests[0].body, r#"{"mode":"SILENT_ACCESS"}"#);
    assert_eq!(fx.initial.get_remote_access_mode().unwrap(), None);
}

#[tokio::test]
async fn not_found_means_unsupported_and_clears_the_mode() {
    let server = mock_server(&[404]).await;
    let fx = fixture(server.url.clone(), Some("DENY_ACCESS")).await;

    run_to_completion(&fx).await;

    assert_eq!(server.requests().len(), 1);
    assert_eq!(fx.initial.get_remote_access_mode().unwrap(), None);
}

#[tokio::test]
async fn conflict_keeps_the_existing_override_and_clears_the_mode() {
    let server = mock_server(&[409]).await;
    let fx = fixture(server.url.clone(), Some("NOTIFY_ONLY")).await;

    run_to_completion(&fx).await;

    assert_eq!(server.requests().len(), 1);
    assert_eq!(fx.initial.get_remote_access_mode().unwrap(), None);
}

#[tokio::test]
async fn failures_are_retried_until_the_backend_answers() {
    let server = mock_server(&[503, 401, 500, 200]).await;
    let fx = fixture(server.url.clone(), Some("APPROVAL_REQUIRED")).await;

    run_to_completion(&fx).await;

    assert_eq!(server.requests().len(), 4);
    assert_eq!(fx.initial.get_remote_access_mode().unwrap(), None);
}

#[tokio::test]
async fn mode_stays_pending_while_the_backend_keeps_failing() {
    let server = mock_server(&[500]).await;
    let fx = fixture(server.url.clone(), Some("SILENT_ACCESS")).await;

    let handle = fx.service.clone().start().unwrap();
    wait_until(|| server.requests().len() >= 2).await;
    handle.abort();

    assert_eq!(
        fx.initial.get_remote_access_mode().unwrap().as_deref(),
        Some("SILENT_ACCESS")
    );
}

#[tokio::test]
async fn dropped_connections_keep_the_mode_pending() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let accepts = Arc::new(Mutex::new(0usize));
    let counter = accepts.clone();
    tokio::spawn(async move {
        while let Ok((socket, _)) = listener.accept().await {
            *counter.lock().unwrap() += 1;
            drop(socket);
        }
    });
    let fx = fixture(url, Some("SILENT_ACCESS")).await;

    let handle = fx.service.clone().start().unwrap();
    wait_until(|| *accepts.lock().unwrap() >= 2).await;
    handle.abort();

    assert_eq!(
        fx.initial.get_remote_access_mode().unwrap().as_deref(),
        Some("SILENT_ACCESS")
    );
}

// Suspension only exists where self-uninstall is supported.
#[cfg(any(target_os = "macos", target_os = "windows"))]
#[tokio::test]
async fn nothing_is_sent_while_the_tenant_is_suspended() {
    let server = mock_server(&[200]).await;
    let fx = fixture(server.url.clone(), Some("SILENT_ACCESS")).await;
    for _ in 0..10 {
        fx.deactivation
            .on_gateway_status(reqwest::StatusCode::GONE)
            .await;
    }
    assert!(fx.deactivation.is_suspended());

    let handle = fx.service.clone().start().unwrap();
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert!(server.requests().is_empty());

    fx.deactivation
        .on_gateway_status(reqwest::StatusCode::OK)
        .await;
    tokio::time::timeout(Duration::from_secs(5), handle)
        .await
        .expect("the mode is sent once the tenant is back")
        .unwrap();
    assert_eq!(server.requests().len(), 1);
    assert_eq!(fx.initial.get_remote_access_mode().unwrap(), None);
}
