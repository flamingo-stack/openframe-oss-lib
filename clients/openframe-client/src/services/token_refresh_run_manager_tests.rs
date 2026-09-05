use super::*;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};

const ISSUED: i64 = 1_800_000_000;
const TTL: i64 = 3600;
const THREE_HOURS: i64 = 3 * 3600;

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
fn refresh_delay_comes_from_token_lifetime_not_device_clock() {
    let now = Instant::now();
    // Device clock three hours ahead: the new token already looks expired to the wall clock.
    let schedule = schedule_after_refresh(&fresh(Some(TTL)), ISSUED + THREE_HOURS, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
    assert_eq!(schedule.not_before - now, MIN_INTERVAL);
}

#[test]
fn refresh_delay_is_the_same_with_an_accurate_clock() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&fresh(Some(TTL)), ISSUED, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
}

#[test]
fn refresh_never_sooner_than_min_interval() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(
        &response(token(Some(ISSUED), ISSUED + 20), Some(20)),
        ISSUED,
        now,
    );
    assert_eq!(schedule.due_at - now, MIN_INTERVAL);
}

#[test]
fn lifetime_falls_back_to_jwt_claims_without_expires_in() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&fresh(None), ISSUED, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
}

#[test]
fn unknown_lifetime_uses_fallback_interval() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&response(token(None, ISSUED + TTL), None), ISSUED, now);
    assert_eq!(schedule.due_at - now, FALLBACK_INTERVAL);
    assert_eq!(schedule.due_wall, None);
}

#[test]
fn wall_deadline_is_corrected_for_clock_skew() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&fresh(Some(TTL)), ISSUED + THREE_HOURS, now);
    assert_eq!(schedule.due_wall, Some(ISSUED + TTL - 300 + THREE_HOURS));
}

#[test]
fn wall_deadline_needs_iat() {
    let now = Instant::now();
    let schedule =
        schedule_after_refresh(&response(token(None, ISSUED + TTL), Some(TTL)), ISSUED, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
    assert_eq!(schedule.due_wall, None);
}

#[test]
fn existing_expired_token_refreshes_immediately() {
    let now = Instant::now();
    let schedule = schedule_for_existing(&token(Some(ISSUED), ISSUED + TTL), ISSUED + TTL + 1, now);
    assert_eq!(schedule.due_at, now);
    assert_eq!(schedule.not_before, now);
}

#[test]
fn existing_fresh_token_waits_remaining_minus_margin() {
    let now = Instant::now();
    let schedule = schedule_for_existing(&token(Some(ISSUED), ISSUED + TTL), ISSUED + 600, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(2700));
}

#[test]
fn existing_token_wait_is_capped_by_lifetime_when_clock_is_behind() {
    let now = Instant::now();
    // Device clock a day behind: the wall clock would wait 27 hours; the token only lives one.
    let schedule = schedule_for_existing(&token(Some(ISSUED), ISSUED + TTL), ISSUED - 86_400, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
}

#[test]
fn existing_undecodable_token_uses_fallback_interval() {
    let now = Instant::now();
    let schedule = schedule_for_existing("not-a-jwt", ISSUED, now);
    assert_eq!(schedule.due_at - now, FALLBACK_INTERVAL);
}

#[tokio::test]
async fn wait_returns_once_due_at_passes() {
    let schedule = RefreshSchedule::at(Instant::now() + Duration::from_millis(50));
    let started = Instant::now();
    schedule.wait().await;
    assert!(started.elapsed() >= Duration::from_millis(50));
}

#[tokio::test]
async fn wait_returns_early_when_wall_deadline_passed() {
    let now = Instant::now();
    let schedule = RefreshSchedule {
        not_before: now,
        due_at: now + Duration::from_secs(3600),
        due_wall: Some(Utc::now().timestamp() - 1),
    };
    let started = Instant::now();
    schedule.wait().await;
    assert!(started.elapsed() < Duration::from_secs(1));
}

#[tokio::test]
async fn wall_deadline_cannot_bypass_the_floor() {
    let now = Instant::now();
    let schedule = RefreshSchedule {
        not_before: now + Duration::from_millis(50),
        due_at: now + Duration::from_secs(3600),
        due_wall: Some(Utc::now().timestamp() - 1),
    };
    let started = Instant::now();
    schedule.wait().await;
    assert!(started.elapsed() >= Duration::from_millis(50));
}
