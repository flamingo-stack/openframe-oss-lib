use std::sync::Arc;

use chrono::Utc;
use tokio::time::{sleep, timeout, Duration, Instant};
use tracing::{debug, error, info, warn};

use crate::models::AgentTokenResponse;
use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::deactivation_service::DeactivationService;
use crate::services::AgentAuthService;
use crate::utils::jwt;

/// Refresh this long before `exp` under normal TTLs.
const REFRESH_MARGIN: Duration = Duration::from_secs(5 * 60);
/// Lead for a short-lived token (TTL <= margin) so it doesn't refresh every loop.
const MIN_LEAD: Duration = Duration::from_secs(15);
/// Used when the token's lifetime can't be determined.
const FALLBACK_INTERVAL: Duration = Duration::from_secs(30 * 60);
/// Floor between two refreshes whatever any clock says — the guard against a hot loop.
const MIN_INTERVAL: Duration = Duration::from_secs(60);
/// The wait is sliced so a resume from suspend (wall clock jumps, monotonic clock may not) is noticed within a slice.
const WAIT_SLICE: Duration = Duration::from_secs(60);
/// Device-vs-server clock difference worth a warning.
const SKEW_WARN: Duration = Duration::from_secs(5 * 60);
/// Delay between refresh attempts after a failure.
const RETRY_INTERVAL: Duration = Duration::from_secs(60);
/// Cap on a single `reauthenticate()` call.
const REAUTH_TIMEOUT: Duration = Duration::from_secs(30);

/// Proactively refreshes the access token before `exp` so `shared_token.enc` stays valid without a NATS reconnect.
#[derive(Clone)]
pub struct TokenRefreshRunManager {
    auth_service: AgentAuthService,
    config_service: AgentConfigurationService,
    deactivation: Arc<DeactivationService>,
}

impl TokenRefreshRunManager {
    pub fn new(
        auth_service: AgentAuthService,
        config_service: AgentConfigurationService,
        deactivation: Arc<DeactivationService>,
    ) -> Self {
        Self {
            auth_service,
            config_service,
            deactivation,
        }
    }

    pub fn start(&self) {
        let auth_service = self.auth_service.clone();
        let config_service = self.config_service.clone();
        let deactivation = self.deactivation.clone();

        info!("Starting proactive token refresh run manager");

        tokio::spawn(async move {
            let mut schedule = match config_service.get_access_token().await {
                Ok(token) if !token.is_empty() => {
                    schedule_for_existing(&token, Utc::now().timestamp(), Instant::now())
                }
                Ok(_) => RefreshSchedule::at(Instant::now()),
                Err(e) => {
                    warn!(
                        "Token refresh: cannot read access token ({e:#}); using fallback interval"
                    );
                    RefreshSchedule::at(Instant::now() + FALLBACK_INTERVAL)
                }
            };

            loop {
                // Tenant-gone suspension: this loop is the single backoff probe. Its outcome is
                // recorded inside AuthClient (410 -> stay gone / advance uninstall; 2xx -> recover).
                if deactivation.is_suspended() {
                    let wait = deactivation.next_probe_delay().await;
                    debug!(
                        "Tenant-gone suspension active; next probe in {}s",
                        wait.as_secs()
                    );
                    sleep(wait).await;
                    if let Ok(Ok(response)) =
                        timeout(REAUTH_TIMEOUT, auth_service.reauthenticate()).await
                    {
                        schedule = schedule_after_refresh(
                            &response,
                            Utc::now().timestamp(),
                            Instant::now(),
                        );
                    }
                    continue;
                }

                schedule.wait().await;

                // Retry on the short interval until a refresh succeeds.
                loop {
                    match timeout(REAUTH_TIMEOUT, auth_service.reauthenticate()).await {
                        Ok(Ok(response)) => {
                            schedule = schedule_after_refresh(
                                &response,
                                Utc::now().timestamp(),
                                Instant::now(),
                            );
                            info!("Proactively refreshed access token; shared_token.enc updated");
                            break;
                        }
                        Ok(Err(e)) => error!(
                            "Proactive token refresh failed: {e:#}; retrying in {}s",
                            RETRY_INTERVAL.as_secs()
                        ),
                        Err(_) => error!(
                            "Proactive token refresh timed out after {}s; retrying in {}s",
                            REAUTH_TIMEOUT.as_secs(),
                            RETRY_INTERVAL.as_secs()
                        ),
                    }
                    // Tenant went gone mid-retry — hand control to the backoff probe above.
                    if deactivation.is_suspended() {
                        schedule = RefreshSchedule::at(Instant::now());
                        break;
                    }
                    sleep(RETRY_INTERVAL).await;
                }
            }
        });
    }
}

/// When the next refresh is due. `due_at` counts the token's own lifetime on the monotonic clock, so the
/// device clock can neither pull the refresh forward nor push it past `exp`; `due_wall` (device wall-clock
/// seconds, skew-corrected) catches a resume from suspend, where the monotonic clock may have stood still.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RefreshSchedule {
    not_before: Instant,
    due_at: Instant,
    due_wall: Option<i64>,
}

impl RefreshSchedule {
    fn at(due_at: Instant) -> Self {
        Self {
            not_before: due_at,
            due_at,
            due_wall: None,
        }
    }

    fn wall_due(&self) -> bool {
        self.due_wall
            .is_some_and(|due| Utc::now().timestamp() >= due)
    }

    /// Sleep until due, in slices so a wall-clock jump past the deadline is caught within a slice.
    async fn wait(&self) {
        let remaining = self.due_at.saturating_duration_since(Instant::now());
        if !remaining.is_zero() {
            debug!("Next proactive token refresh in {}s", remaining.as_secs());
        }
        loop {
            let now = Instant::now();
            let floor = self.not_before.saturating_duration_since(now);
            if !floor.is_zero() {
                sleep(floor).await;
                continue;
            }
            let remaining = self.due_at.saturating_duration_since(now);
            if remaining.is_zero() || self.wall_due() {
                return;
            }
            sleep(remaining.min(WAIT_SLICE)).await;
        }
    }
}

/// Full margin normally; `MIN_LEAD` for a short-lived token.
fn lead_for(ttl: Duration) -> Duration {
    if ttl > REFRESH_MARGIN {
        REFRESH_MARGIN
    } else {
        MIN_LEAD
    }
}

/// Schedule after a successful refresh: the server-granted lifetime counted from receipt, never sooner than `MIN_INTERVAL`.
fn schedule_after_refresh(
    response: &AgentTokenResponse,
    now_wall: i64,
    now_mono: Instant,
) -> RefreshSchedule {
    let not_before = now_mono + MIN_INTERVAL;
    let times = jwt::token_times_unix(&response.access_token);
    let ttl = response
        .expires_in
        .filter(|secs| *secs > 0)
        .or_else(|| times.and_then(|t| t.ttl_secs()))
        .map(|secs| Duration::from_secs(secs as u64));
    let Some(ttl) = ttl else {
        warn!("Token refresh: token lifetime unknown; using fallback interval");
        return RefreshSchedule {
            not_before,
            due_at: now_mono + FALLBACK_INTERVAL,
            due_wall: None,
        };
    };
    let lead = lead_for(ttl);
    let delay = ttl.saturating_sub(lead).max(MIN_INTERVAL);

    // Device clock minus server clock, measured against the freshly minted `iat`.
    let skew = times.and_then(|t| t.iat).map(|iat| now_wall - iat);
    if let Some(skew) = skew {
        if skew.unsigned_abs() >= SKEW_WARN.as_secs() {
            warn!(
                skew_s = skew,
                "Device clock differs from the server; refresh timing is taken from the token lifetime"
            );
        }
    }
    let due_wall = match (times, skew) {
        (Some(times), Some(skew)) => Some(times.exp - lead.as_secs() as i64 + skew),
        _ => None,
    };

    RefreshSchedule {
        not_before,
        due_at: now_mono + delay,
        due_wall,
    }
}

/// Schedule for the token found at startup: its receipt time is unknown, so the device clock estimates the
/// remaining life, trusted only within the token's own lifetime — a skewed clock costs at most one early refresh.
fn schedule_for_existing(token: &str, now_wall: i64, now_mono: Instant) -> RefreshSchedule {
    let Some(times) = jwt::token_times_unix(token) else {
        warn!("Token refresh: access token has no decodable exp; using fallback interval");
        return RefreshSchedule::at(now_mono + FALLBACK_INTERVAL);
    };
    let ttl = times
        .ttl_secs()
        .map(|secs| Duration::from_secs(secs as u64))
        .unwrap_or(FALLBACK_INTERVAL);
    let remaining = (times.exp - now_wall).clamp(0, ttl.as_secs() as i64);
    let delay = Duration::from_secs(remaining as u64).saturating_sub(lead_for(ttl));
    RefreshSchedule::at(now_mono + delay)
}

#[cfg(test)]
#[path = "token_refresh_run_manager_tests.rs"]
mod tests;
