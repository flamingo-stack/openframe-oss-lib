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
fn lifetime_falls_back_to_jwt_claims_when_expires_in_is_not_positive() {
    let now = Instant::now();
    for expires_in in [Some(0), Some(-1)] {
        let schedule = schedule_after_refresh(&fresh(expires_in), ISSUED, now);
        assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
    }
}

#[test]
fn unknown_lifetime_uses_fallback_interval() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&response(token(None, ISSUED + TTL), None), ISSUED, now);
    assert_eq!(schedule.due_at - now, FALLBACK_INTERVAL);
    assert_eq!(
        schedule.due_wall,
        ISSUED + FALLBACK_INTERVAL.as_secs() as i64
    );
}

#[test]
fn bogus_lifetime_is_capped() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&fresh(Some(i64::MAX)), ISSUED, now);
    assert_eq!(schedule.due_at - now, MAX_TTL - REFRESH_MARGIN);
}

#[test]
fn wall_deadline_follows_the_device_clock_from_receipt() {
    let now = Instant::now();
    let schedule = schedule_after_refresh(&fresh(Some(TTL)), ISSUED + THREE_HOURS, now);
    assert_eq!(schedule.due_wall, ISSUED + THREE_HOURS + 3300);
}

#[test]
fn wall_deadline_is_set_without_iat() {
    let now = Instant::now();
    let schedule =
        schedule_after_refresh(&response(token(None, ISSUED + TTL), Some(TTL)), ISSUED, now);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
    assert_eq!(schedule.due_wall, ISSUED + 3300);
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
    assert_eq!(schedule.due_wall, ISSUED + 600 + 2700);
}

#[test]
fn existing_token_refreshes_immediately_when_clock_is_provably_behind() {
    let now = Instant::now();
    // Device clock a day behind: more life "left" than the token ever had.
    let schedule = schedule_for_existing(&token(Some(ISSUED), ISSUED + TTL), ISSUED - 86_400, now);
    assert_eq!(schedule.due_at, now);
}

#[test]
fn existing_token_without_iat_refreshes_immediately() {
    let now = Instant::now();
    let schedule = schedule_for_existing(&token(None, ISSUED + TTL), ISSUED, now);
    assert_eq!(schedule.due_at, now);
}

#[test]
fn existing_undecodable_token_uses_fallback_interval() {
    let now = Instant::now();
    let schedule = schedule_for_existing("not-a-jwt", ISSUED, now);
    assert_eq!(schedule.due_at - now, FALLBACK_INTERVAL);
}

#[test]
fn after_stamps_the_same_delay_on_both_clocks() {
    let now = Instant::now();
    let schedule = RefreshSchedule::after(now, ISSUED, Duration::from_secs(3300), MIN_INTERVAL);
    assert_eq!(schedule.due_at - now, Duration::from_secs(3300));
    assert_eq!(schedule.due_wall, ISSUED + 3300);
    assert_eq!(schedule.not_before - now, MIN_INTERVAL);
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
    schedule.wait().await;
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
    schedule.wait().await;
    assert!(started.elapsed() < Duration::from_secs(1));
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
    schedule.wait().await;
    assert!(started.elapsed() >= Duration::from_millis(50));
}
