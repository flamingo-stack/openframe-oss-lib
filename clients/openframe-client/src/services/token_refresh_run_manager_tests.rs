use super::*;
use crate::clients::AuthClient;
use crate::platform::directories::DirectoryManager;
use crate::services::shared_token_service::SharedTokenService;
use crate::services::EncryptionService;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use std::sync::Mutex;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const ISSUED: i64 = 1_800_000_000;
const TTL: i64 = 3600;
const THREE_HOURS: i64 = 3 * 3600;
const PROD: RefreshTiming = RefreshTiming {
    margin: Duration::from_secs(300),
    min_lead: Duration::from_secs(30),
    fallback_interval: Duration::from_secs(1800),
    max_ttl: Duration::from_secs(86_400),
    min_interval: Duration::from_secs(60),
    wait_slice: Duration::from_secs(60),
    retry_interval: Duration::from_secs(60),
    reauth_timeout: Duration::from_secs(30),
};
/// Production timing scaled to milliseconds so the real loop can be observed within a test.
const FAST: RefreshTiming = RefreshTiming {
    margin: Duration::from_millis(100),
    min_lead: Duration::from_millis(50),
    fallback_interval: Duration::from_secs(5),
    max_ttl: Duration::from_secs(86_400),
    min_interval: Duration::from_millis(200),
    wait_slice: Duration::from_millis(50),
    retry_interval: Duration::from_millis(100),
    reauth_timeout: Duration::from_secs(2),
};

impl TokenRefreshRunManager {
    fn with_timing(mut self, timing: RefreshTiming) -> Self {
        self.timing = timing;
        self
    }
}

fn token(iat: Option<i64>, exp: i64) -> String {
    let payload = match iat {
        Some(iat) => format!(r#"{{"iat":{iat},"exp":{exp}}}"#),
        None => format!(r#"{{"exp":{exp}}}"#),
    };
    format!("h.{}.s", URL_SAFE_NO_PAD.encode(payload.as_bytes()))
}

fn response(access_token: String, expires_in: Option<i64>) -> AgentTokenResponse {
    AgentTokenResponse {
        access_token,
        refresh_token: "refresh".into(),
        token_type: "Bearer".into(),
        expires_in,
    }
}

fn fresh(expires_in: Option<i64>) -> AgentTokenResponse {
    response(token(Some(ISSUED), ISSUED + TTL), expires_in)
}

#[test]
fn production_timing_matches_the_documented_values() {
    let timing = RefreshTiming::default();
    assert_eq!(timing.margin, PROD.margin);
    assert_eq!(timing.min_lead, PROD.min_lead);
    assert_eq!(timing.fallback_interval, PROD.fallback_interval);
    assert_eq!(timing.max_ttl, PROD.max_ttl);
    assert_eq!(timing.min_interval, PROD.min_interval);
    assert_eq!(timing.wait_slice, PROD.wait_slice);
    assert_eq!(timing.retry_interval, PROD.retry_interval);
    assert_eq!(timing.reauth_timeout, PROD.reauth_timeout);
}

#[test]
fn refresh_delay_comes_from_token_lifetime_not_device_clock() {
    let now = Instant::now();
    // Device clock three hours ahead: the new token already looks expired to the wall clock.
    let schedule = schedule_after_refresh(&PROD, &fresh(Some(TTL)), ISSUED + THREE_HOURS, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
    assert_eq!(schedule.not_before - now, PROD.min_interval);
}

#[test]
fn refresh_delay_is_the_same_with_an_accurate_clock() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&PROD, &fresh(Some(TTL)), ISSUED, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
}

#[test]
fn refresh_never_sooner_than_min_interval() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(
        &PROD,
        &response(token(Some(ISSUED), ISSUED + 20), Some(20)),
        ISSUED,
        now,
    );
    assert_eq!(schedule.due_at - now, PROD.min_interval);
}

#[test]
fn lifetime_falls_back_to_jwt_claims_without_expires_in() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&PROD, &fresh(None), ISSUED, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
}

#[test]
fn lifetime_falls_back_to_jwt_claims_when_expires_in_is_not_positive() {
    let now = Instant::now();
    for expires_in in [Some(0), Some(-1)] {
        let schedule = schedule_after_refresh(&PROD, &fresh(expires_in), ISSUED, now);
        assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
    }
}

#[test]
fn lifetime_is_the_shorter_of_expires_in_and_jwt_claims() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&PROD, &fresh(Some(7200)), ISSUED, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
    let schedule = schedule_after_refresh(&PROD, &fresh(Some(1800)), ISSUED, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(1500));
}

#[test]
fn unknown_lifetime_uses_fallback_interval() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(
        &PROD,
        &response(token(None, ISSUED + TTL), None),
        ISSUED,
        now,
    );
    assert_eq!(schedule.due_at - now, PROD.fallback_interval);
    assert_eq!(
        schedule.due_wall,
        ISSUED + PROD.fallback_interval.as_secs() as i64
    );
}

#[test]
fn bogus_lifetime_is_capped() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(
        &PROD,
        &response(token(None, ISSUED + TTL), Some(i64::MAX)),
        ISSUED,
        now,
    );
    assert_eq!(schedule.due_at - now, PROD.max_ttl - PROD.margin);
}

#[test]
fn wall_deadline_follows_the_device_clock_from_receipt() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&PROD, &fresh(Some(TTL)), ISSUED + THREE_HOURS, now);
    assert_eq!(schedule.due_wall, ISSUED + THREE_HOURS + 3300);
}

#[test]
fn wall_deadline_is_set_without_iat() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(
        &PROD,
        &response(token(None, ISSUED + TTL), Some(TTL)),
        ISSUED,
        now,
    );
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
    assert_eq!(schedule.due_wall, ISSUED + 3300);
}

#[test]
fn existing_token_minted_just_now_waits_out_its_lifetime() {
    let now = Instant::now();
    // Initial authentication ran 10 s ago by the device clock.
    let schedule =
        schedule_for_existing(&PROD, &token(Some(ISSUED), ISSUED + TTL), ISSUED + 10, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3290));
    assert_eq!(schedule.not_before, now);
}

#[test]
fn existing_token_older_than_min_interval_refreshes_immediately() {
    let now = Instant::now();
    // Ten minutes old by a clock that may be off by any amount: its real remaining life is unknowable.
    let schedule =
        schedule_for_existing(&PROD, &token(Some(ISSUED), ISSUED + TTL), ISSUED + 600, now);
    assert_eq!(schedule.due_at, now);
    assert_eq!(schedule.not_before, now);
}

#[test]
fn existing_expired_token_refreshes_immediately() {
    let now = Instant::now();
    let schedule = schedule_for_existing(
        &PROD,
        &token(Some(ISSUED), ISSUED + TTL),
        ISSUED + TTL + 1,
        now,
    );
    assert_eq!(schedule.due_at, now);
}

#[test]
fn existing_token_refreshes_immediately_when_clock_is_behind() {
    let now = Instant::now();
    // Device clock a day behind: the token looks minted in the future.
    let schedule = schedule_for_existing(
        &PROD,
        &token(Some(ISSUED), ISSUED + TTL),
        ISSUED - 86_400,
        now,
    );
    assert_eq!(schedule.due_at, now);
}

#[test]
fn existing_token_without_iat_refreshes_immediately() {
    let now = Instant::now();
    let schedule = schedule_for_existing(&PROD, &token(None, ISSUED + TTL), ISSUED, now);
    assert_eq!(schedule.due_at, now);
}

#[test]
fn existing_undecodable_token_refreshes_immediately() {
    let now = Instant::now();
    let schedule = schedule_for_existing(&PROD, "not-a-jwt", ISSUED, now);
    assert_eq!(schedule.due_at, now);
}

#[test]
fn after_stamps_the_same_delay_on_both_clocks() {
    let now = Instant::now();
    let schedule =
        RefreshSchedule::after(now, ISSUED, Duration::from_secs(3300), PROD.min_interval);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
    assert_eq!(schedule.due_wall, ISSUED + 3300);
    assert_eq!(schedule.not_before - now, PROD.min_interval);
}

#[test]
fn after_rounds_the_wall_deadline_up() {
    let now = Instant::now();
    let schedule = RefreshSchedule::after(now, ISSUED, Duration::from_millis(50), Duration::ZERO);
    assert_eq!(schedule.due_wall, ISSUED + 1);
    assert_eq!(schedule.not_before, now);
}

#[tokio::test]
async fn wait_ignores_a_future_wall_deadline() {
    let now = Instant::now();
    let schedule = RefreshSchedule {
        not_before: now,
        due_at: now + Duration::from_millis(50),
        due_wall: Utc::now().timestamp() + 3600,
    };
    let started = Instant::now();
    schedule.wait(Duration::from_millis(10)).await;
    assert!(started.elapsed() >= Duration::from_millis(50));
}

#[tokio::test]
async fn wait_returns_early_when_wall_deadline_passed() {
    let now = Instant::now();
    let schedule = RefreshSchedule {
        not_before: now,
        due_at: now + Duration::from_secs(3600),
        due_wall: Utc::now().timestamp() - 1,
    };
    let started = Instant::now();
    schedule.wait(PROD.wait_slice).await;
    assert!(started.elapsed() < Duration::from_secs(1));
}

#[tokio::test]
async fn wait_notices_the_wall_deadline_arriving_mid_wait() {
    // Resume from suspend: the monotonic deadline is hours away, the wall clock reaches its deadline first.
    let now = Instant::now();
    let schedule = RefreshSchedule {
        not_before: now,
        due_at: now + Duration::from_secs(3600),
        due_wall: Utc::now().timestamp() + 1,
    };
    let started = Instant::now();
    schedule.wait(Duration::from_millis(50)).await;
    assert!(started.elapsed() < Duration::from_secs(3));
}

#[tokio::test]
async fn wall_deadline_cannot_bypass_the_floor() {
    let now = Instant::now();
    let schedule = RefreshSchedule {
        not_before: now + Duration::from_millis(50),
        due_at: now + Duration::from_secs(3600),
        due_wall: Utc::now().timestamp() - 1,
    };
    let started = Instant::now();
    schedule.wait(PROD.wait_slice).await;
    assert!(started.elapsed() >= Duration::from_millis(50));
}

/// Minimal HTTP/1.1 token endpoint: every request gets a token minted `issued_offset` seconds from now.
struct MockAuthServer {
    url: String,
    hits: Arc<Mutex<Vec<Instant>>>,
}

impl MockAuthServer {
    fn hits(&self) -> Vec<Instant> {
        self.hits.lock().unwrap().clone()
    }
}

async fn mock_auth_server(ttl: i64, issued_offset: i64) -> MockAuthServer {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let hits = Arc::new(Mutex::new(Vec::new()));
    let recorder = hits.clone();
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = listener.accept().await {
            let recorder = recorder.clone();
            tokio::spawn(async move {
                let mut buf = vec![0u8; 8192];
                let mut read = 0;
                while read < buf.len() {
                    let n = socket.read(&mut buf[read..]).await.unwrap_or(0);
                    if n == 0 {
                        break;
                    }
                    read += n;
                    let head = String::from_utf8_lossy(&buf[..read]).to_ascii_lowercase();
                    if let Some(end) = head.find("\r\n\r\n") {
                        let body_len = head
                            .lines()
                            .find_map(|l| l.strip_prefix("content-length:"))
                            .and_then(|v| v.trim().parse::<usize>().ok())
                            .unwrap_or(0);
                        if read >= end + 4 + body_len {
                            break;
                        }
                    }
                }
                recorder.lock().unwrap().push(Instant::now());
                let iat = Utc::now().timestamp() + issued_offset;
                let body = format!(
                    r#"{{"accessToken":"{}","refreshToken":"r","tokenType":"Bearer","expiresIn":{ttl}}}"#,
                    token(Some(iat), iat + ttl)
                );
                let reply = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = socket.write_all(reply.as_bytes()).await;
                let _ = socket.shutdown().await;
            });
        }
    });
    MockAuthServer { url, hits }
}

/// A registered agent in a temp dir holding a token from two hours ago, wired to `base_url`.
async fn registered_manager(dir: &tempfile::TempDir, base_url: String) -> TokenRefreshRunManager {
    let dm = DirectoryManager::with_custom_dirs(
        dir.path().join("logs"),
        dir.path().join("app"),
        dir.path().join("secured"),
    );
    let config = AgentConfigurationService::new(dm.clone()).unwrap();
    config
        .save_registration_data("machine".into(), "client".into(), "secret".into())
        .await
        .unwrap();
    let issued = Utc::now().timestamp() - 7200;
    config
        .update_tokens(token(Some(issued), issued + TTL), "refresh".into())
        .await
        .unwrap();
    let deactivation = DeactivationService::new(&dm);
    let auth_client = AuthClient::new(base_url, reqwest::Client::new(), deactivation.clone());
    let shared = SharedTokenService::new(dm, EncryptionService::new());
    let auth = AgentAuthService::new(auth_client, config.clone(), shared);
    TokenRefreshRunManager::new(auth, config, deactivation).with_timing(FAST)
}

fn min_gap(hits: &[Instant]) -> Option<Duration> {
    hits.windows(2).map(|w| w[1] - w[0]).min()
}

#[tokio::test]
async fn real_loop_stays_bounded_when_every_token_looks_already_expired() {
    // Tokens minted three hours in the past are what a device three hours ahead of the server sees.
    let server = mock_auth_server(1, -THREE_HOURS).await;
    let dir = tempfile::tempdir().unwrap();
    registered_manager(&dir, server.url.clone()).await.start();

    tokio::time::sleep(Duration::from_secs(3)).await;

    // One refresh at start, then one per lifetime (1 s) — never closer than the floor; the old code did hundreds.
    let hits = server.hits();
    assert!(
        (2..=12).contains(&hits.len()),
        "refreshes in 3 s: {}",
        hits.len()
    );
    assert!(min_gap(&hits).unwrap() >= FAST.min_interval - Duration::from_millis(10));
}

#[tokio::test]
async fn real_loop_has_the_same_cadence_with_an_accurate_clock() {
    let server = mock_auth_server(1, 0).await;
    let dir = tempfile::tempdir().unwrap();
    registered_manager(&dir, server.url.clone()).await.start();

    tokio::time::sleep(Duration::from_secs(3)).await;

    let hits = server.hits();
    assert!(
        (2..=12).contains(&hits.len()),
        "refreshes in 3 s: {}",
        hits.len()
    );
    assert!(min_gap(&hits).unwrap() >= FAST.min_interval - Duration::from_millis(10));
}

#[tokio::test]
async fn real_loop_refreshes_the_stale_token_once_and_then_waits_out_the_lifetime() {
    let server = mock_auth_server(TTL, -THREE_HOURS).await;
    let dir = tempfile::tempdir().unwrap();
    registered_manager(&dir, server.url.clone()).await.start();

    tokio::time::sleep(Duration::from_secs(2)).await;

    assert_eq!(server.hits().len(), 1);
}
