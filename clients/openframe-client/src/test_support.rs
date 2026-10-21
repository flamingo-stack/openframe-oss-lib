use std::collections::VecDeque;
use std::net::{TcpListener, TcpStream};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tempfile::TempDir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::platform::directories::DirectoryManager;
use crate::services::backend_call_retry::RetryTiming;
use crate::services::AgentConfigurationService;

const READY_BOUND: Duration = Duration::from_secs(10);

pub(crate) struct NatsServer {
    child: Child,
    port: u16,
    _store: TempDir,
}

impl NatsServer {
    pub(crate) fn start() -> Option<Self> {
        let binary = std::env::var("NATS_SERVER_BIN").unwrap_or_else(|_| "nats-server".to_string());
        let port = TcpListener::bind("127.0.0.1:0")
            .and_then(|listener| listener.local_addr())
            .expect("no free local port")
            .port();
        let store = tempfile::tempdir().unwrap();

        let spawned = Command::new(&binary)
            .args(["-a", "127.0.0.1", "-p", &port.to_string(), "-js", "-sd"])
            .arg(store.path())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
        let child = match spawned {
            Ok(child) => child,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                if std::env::var("REQUIRE_NATS_SERVER").as_deref() == Ok("1") {
                    panic!("REQUIRE_NATS_SERVER=1 but `{binary}` is not installed");
                }
                eprintln!("skipping: `{binary}` is not installed (brew install nats-server)");
                return None;
            }
            Err(e) => panic!("failed to start `{binary}`: {e}"),
        };

        let server = Self {
            child,
            port,
            _store: store,
        };
        let started = Instant::now();
        while TcpStream::connect(("127.0.0.1", port)).is_err() {
            assert!(
                started.elapsed() < READY_BOUND,
                "nats-server did not start listening on {port}"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
        Some(server)
    }

    pub(crate) fn url(&self) -> String {
        format!("nats://127.0.0.1:{}", self.port)
    }
}

impl Drop for NatsServer {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

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
        .save_registration_data("machine".into(), "client".into(), "secret".into(), None)
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
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
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
