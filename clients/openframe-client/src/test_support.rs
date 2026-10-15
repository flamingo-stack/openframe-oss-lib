use std::net::{TcpListener, TcpStream};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use tempfile::TempDir;

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
