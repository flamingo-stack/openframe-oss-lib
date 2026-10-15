//! Fixtures shared by the tests of services that call the backend.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use tempfile::TempDir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::Duration;

use crate::platform::directories::DirectoryManager;
use crate::services::backend_call_retry::RetryTiming;
use crate::services::AgentConfigurationService;

pub(crate) const FAST: RetryTiming = RetryTiming {
    initial: Duration::from_millis(20),
    max: Duration::from_millis(40),
};

pub(crate) fn directories(dir: &TempDir) -> DirectoryManager {
    DirectoryManager::with_custom_dirs(
        dir.path().join("logs"),
        dir.path().join("app"),
        dir.path().join("secured"),
    )
}

/// Agent configuration of a registered machine whose access token is `machine-token`.
pub(crate) async fn registered_agent(dm: &DirectoryManager) -> AgentConfigurationService {
    let agent = AgentConfigurationService::new(dm.clone()).unwrap();
    agent
        .save_registration_data("machine".into(), "client".into(), "secret".into())
        .await
        .unwrap();
    agent
        .update_tokens("machine-token".into(), "refresh".into())
        .await
        .unwrap();
    agent
}

pub(crate) async fn wait_until(condition: impl Fn() -> bool) {
    tokio::time::timeout(Duration::from_secs(5), async {
        while !condition() {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("condition met within the deadline");
}

/// Raw HTTP request as the mock server received it.
#[derive(Debug, Clone)]
pub(crate) struct Recorded {
    pub(crate) request_line: String,
    pub(crate) head: String,
    pub(crate) body: String,
}

/// Minimal HTTP/1.1 server answering with `statuses` in order and repeating the last one.
pub(crate) struct MockServer {
    pub(crate) url: String,
    requests: Arc<Mutex<Vec<Recorded>>>,
}

impl MockServer {
    pub(crate) fn requests(&self) -> Vec<Recorded> {
        self.requests.lock().unwrap().clone()
    }
}

pub(crate) async fn mock_server(statuses: &[u16]) -> MockServer {
    mock_server_with_body(statuses, "").await
}

/// Same as [`mock_server`], with `body` in every response.
pub(crate) async fn mock_server_with_body(statuses: &[u16], body: &str) -> MockServer {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let requests = Arc::new(Mutex::new(Vec::new()));
    let recorder = requests.clone();
    let statuses = Arc::new(Mutex::new(
        statuses.iter().copied().collect::<VecDeque<_>>(),
    ));
    let reply_body = body.to_string();
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = listener.accept().await {
            let recorder = recorder.clone();
            let statuses = statuses.clone();
            let reply_body = reply_body.clone();
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
                    "HTTP/1.1 {status} X\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{reply_body}",
                    reply_body.len()
                );
                let _ = socket.write_all(reply.as_bytes()).await;
                let _ = socket.shutdown().await;
            });
        }
    });
    MockServer { url, requests }
}
