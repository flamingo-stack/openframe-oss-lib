// Suspension only exists where self-uninstall is supported.
#![cfg(any(target_os = "macos", target_os = "windows"))]

use super::*;
use crate::test_support::directories;

struct Fixture {
    _dir: tempfile::TempDir,
    marker: PathBuf,
    service: Arc<DeactivationService>,
    commands: mpsc::UnboundedReceiver<DeactivationCommand>,
}

impl Fixture {
    fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let dm = directories(&dir);
        std::fs::create_dir_all(dm.secured_dir()).unwrap();
        let service = DeactivationService::new(&dm);
        let commands = service.commands_rx.lock().unwrap().take().unwrap();
        Self {
            marker: marker_path(dm.secured_dir()),
            _dir: dir,
            service,
            commands,
        }
    }

    async fn feed(&self, status: StatusCode, times: usize) {
        for _ in 0..times {
            self.service.on_gateway_status(status).await;
        }
    }

    fn sent(&mut self) -> Vec<DeactivationCommand> {
        std::iter::from_fn(|| self.commands.try_recv().ok()).collect()
    }

    async fn probe_delays_secs(&self, count: usize) -> Vec<u64> {
        let mut secs = Vec::new();
        for _ in 0..count {
            secs.push(self.service.next_probe_delay().await.as_secs());
        }
        secs
    }
}

#[tokio::test]
async fn repeated_403s_pause_without_a_gone_marker() {
    let mut fx = Fixture::new();
    fx.feed(StatusCode::FORBIDDEN, 4).await;
    for transient in [
        StatusCode::UNAUTHORIZED,
        StatusCode::TOO_MANY_REQUESTS,
        StatusCode::BAD_GATEWAY,
    ] {
        fx.feed(transient, 1).await;
    }
    assert!(!fx.service.is_suspended(), "four stay healthy");

    fx.feed(StatusCode::FORBIDDEN, 1).await;
    assert!(fx.service.is_suspended(), "the fifth pauses");
    assert_eq!(fx.sent(), [DeactivationCommand::StopTools]);
    assert!(!fx.marker.exists(), "no tenant-gone marker");
}

#[tokio::test]
async fn a_403_the_fallback_recovers_from_never_pauses() {
    let mut fx = Fixture::new();
    for _ in 0..10 {
        fx.feed(StatusCode::FORBIDDEN, 1).await;
        fx.feed(StatusCode::OK, 1).await;
    }
    assert!(!fx.service.is_suspended());
    assert!(fx.sent().is_empty());
}

#[tokio::test]
async fn first_success_ends_a_403_pause_and_restarts_the_tools() {
    let mut fx = Fixture::new();
    fx.feed(StatusCode::FORBIDDEN, 5).await;
    assert!(fx.service.is_suspended());
    fx.feed(StatusCode::UNAUTHORIZED, 3).await;
    fx.feed(StatusCode::TOO_MANY_REQUESTS, 3).await;
    fx.feed(StatusCode::BAD_GATEWAY, 3).await;
    assert!(fx.service.is_suspended(), "401, 429 and 5xx are transient");

    fx.feed(StatusCode::OK, 1).await;
    assert!(!fx.service.is_suspended());
    assert_eq!(
        fx.sent(),
        [
            DeactivationCommand::StopTools,
            DeactivationCommand::RestartTools
        ]
    );
}

#[tokio::test]
async fn a_pause_probes_back_off_up_to_ten_minutes() {
    for status in [StatusCode::FORBIDDEN, StatusCode::GONE] {
        let fx = Fixture::new();
        fx.feed(status, 5).await;
        assert!(fx.service.is_suspended(), "{status}");
        assert_eq!(
            fx.marker.exists(),
            status == StatusCode::GONE,
            "{status}: tenant-gone marker"
        );
        assert_eq!(
            fx.probe_delays_secs(7).await,
            [60, 120, 240, 480, 600, 600, 600],
            "{status}"
        );
    }
}

#[tokio::test]
async fn a_410_during_a_403_pause_starts_the_gone_clock() {
    let fx = Fixture::new();
    fx.feed(StatusCode::FORBIDDEN, 5).await;
    fx.feed(StatusCode::GONE, 1).await;
    assert!(fx.marker.exists());
}

#[tokio::test]
async fn a_403_pause_needs_five_410s_to_uninstall_past_the_gone_deadline() {
    let Some(started) = Instant::now().checked_sub(POST_RESTART_GRACE) else {
        return;
    };
    let mut fx = Fixture::new();
    {
        let mut st = fx.service.state.lock().await;
        st.process_started = started;
        let past_deadline = UNINSTALL_AFTER + Duration::from_secs(60);
        st.gone_since = Some(Utc::now() - chrono::Duration::from_std(past_deadline).unwrap());
    }

    fx.feed(StatusCode::FORBIDDEN, 5).await;
    fx.feed(StatusCode::GONE, 1).await;
    assert_eq!(
        fx.sent(),
        [DeactivationCommand::StopTools],
        "one 410 after a 403 pause uninstalled"
    );

    fx.feed(StatusCode::GONE, 4).await;
    assert_eq!(fx.sent(), [DeactivationCommand::Uninstall]);
}
