use super::*;
use crate::models::InitialConfiguration;
use crate::platform::directories::DirectoryManager;
use std::collections::VecDeque;
use std::sync::Mutex;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const FAST: RetryTiming = RetryTiming {
    initial: Duration::from_millis(20),
    max: Duration::from_millis(40),
};

/// Raw HTTP request as the mock server received it.
#[derive(Debug, Clone)]
struct Recorded {
    request_line: String,
    head: String,
    body: String,
}

/// Minimal HTTP/1.1 server answering with `statuses` in order and repeating the last one.
struct MockServer {
    url: String,
    requests: Arc<Mutex<Vec<Recorded>>>,
}

impl MockServer {
    fn requests(&self) -> Vec<Recorded> {
        self.requests.lock().unwrap().clone()
    }
}

async fn mock_server(statuses: &[u16]) -> MockServer {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let requests = Arc::new(Mutex::new(Vec::new()));
    let recorder = requests.clone();
    let statuses = Arc::new(Mutex::new(
        statuses.iter().copied().collect::<VecDeque<_>>(),
    ));
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = listener.accept().await {
            let recorder = recorder.clone();
            let statuses = statuses.clone();
            tokio::spawn(async move {
                let mut buf = vec![0u8; 8192];
                let mut read = 0;
                let (head_end, body_len) = loop {
                    let n = socket.read(&mut buf[read..]).await.unwrap_or(0);
                    read += n;
                    let text = String::from_utf8_lossy(&buf[..read]).to_string();
                    if let Some(end) = text.find("\r\n\r\n") {
                        let body_len = text
                            .to_ascii_lowercase()
                            .lines()
                            .find_map(|l| l.strip_prefix("content-length:"))
                            .and_then(|v| v.trim().parse::<usize>().ok())
                            .unwrap_or(0);
                        if read >= end + 4 + body_len || n == 0 {
                            break (end, body_len);
                        }
                    } else if n == 0 {
                        return;
                    }
                };
                let text = String::from_utf8_lossy(&buf[..read]).to_string();
                let head = text[..head_end].to_string();
                recorder.lock().unwrap().push(Recorded {
                    request_line: head.lines().next().unwrap_or_default().to_string(),
                    body: text[head_end + 4..(head_end + 4 + body_len).min(read)].to_string(),
                    head,
                });
                let status = {
                    let mut queue = statuses.lock().unwrap();
                    if queue.len() > 1 {
                        queue.pop_front().unwrap()
                    } else {
                        *queue.front().unwrap()
                    }
                };
                let reply = format!(
                    "HTTP/1.1 {status} X\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                );
                let _ = socket.write_all(reply.as_bytes()).await;
                let _ = socket.shutdown().await;
            });
        }
    });
    MockServer { url, requests }
}

struct Fixture {
    _dir: tempfile::TempDir,
    initial: InitialConfigurationService,
    service: Arc<RemoteAccessModeService>,
}

async fn fixture(base_url: String, pending: Option<&str>) -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let dm = DirectoryManager::with_custom_dirs(
        dir.path().join("logs"),
        dir.path().join("app"),
        dir.path().join("secured"),
    );
    let initial = InitialConfigurationService::new(dm.clone()).unwrap();
    initial
        .save(&InitialConfiguration {
            server_host: "acme.openframe.ai".into(),
            remote_access_mode: pending.map(str::to_string),
            ..Default::default()
        })
        .unwrap();
    let agent = AgentConfigurationService::new(dm.clone()).unwrap();
    agent
        .save_registration_data("machine".into(), "client".into(), "secret".into())
        .await
        .unwrap();
    agent
        .update_tokens("machine-token".into(), "refresh".into())
        .await
        .unwrap();
    let mut service = RemoteAccessModeService::new(
        reqwest::Client::new(),
        base_url,
        initial.clone(),
        agent,
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
        .expect("a pending mode starts a task");
    tokio::time::timeout(Duration::from_secs(5), handle)
        .await
        .expect("the task settles the pending mode")
        .unwrap();
}

async fn wait_until(condition: impl Fn() -> bool) {
    tokio::time::timeout(Duration::from_secs(5), async {
        while !condition() {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("condition met within the deadline");
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

#[test]
fn production_retry_timing() {
    let timing = RetryTiming::default();
    assert_eq!(timing.initial, Duration::from_secs(30));
    assert_eq!(timing.max, Duration::from_secs(1800));
}
