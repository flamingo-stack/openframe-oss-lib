use std::sync::Arc;

use chrono::Utc;
use tokio::time::{sleep, timeout, Duration, Instant};
use tracing::{debug, error, info, warn};

use crate::models::AgentTokenResponse;
use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::deactivation_service::DeactivationService;
use crate::services::AgentAuthService;
use crate::utils::jwt;

/// Device-vs-server clock difference worth a warning.
const SKEW_WARN: Duration = Duration::from_secs(5 * 60);

/// Refresh timing; production values by default, shrunk in tests to run the real loop at millisecond scale.
#[derive(Debug, Clone, Copy)]
struct RefreshTiming {
    /// Refresh this long before `exp` under normal TTLs.
    margin: Duration,
    /// Lead for a short-lived token (TTL <= margin) so it doesn't refresh every loop.
    min_lead: Duration,
    /// Used when the token's lifetime can't be determined.
    fallback_interval: Duration,
    /// Cap on a lifetime read from the token, so a bogus claim can't overflow the timers.
    max_ttl: Duration,
    /// Floor between two refreshes whatever any clock says — the guard against a hot loop.
    min_interval: Duration,
    /// The wait is sliced so a resume from suspend (wall clock jumps, monotonic clock may not) is noticed within a slice.
    wait_slice: Duration,
    /// Delay between refresh attempts after a failure.
    retry_interval: Duration,
    /// Cap on a single `reauthenticate()` call.
    reauth_timeout: Duration,
}

impl Default for RefreshTiming {
    fn default() -> Self {
        Self {
            margin: Duration::from_secs(5 * 60),
            min_lead: Duration::from_secs(15),
            fallback_interval: Duration::from_secs(30 * 60),
            max_ttl: Duration::from_secs(24 * 3600),
            min_interval: Duration::from_secs(60),
            wait_slice: Duration::from_secs(60),
            retry_interval: Duration::from_secs(60),
            reauth_timeout: Duration::from_secs(30),
        }
    }
}

/// Proactively refreshes the access token before `exp` so `shared_token.enc` stays valid without a NATS reconnect.
#[derive(Clone)]
pub struct TokenRefreshRunManager {
    auth_service: AgentAuthService,
    config_service: AgentConfigurationService,
    deactivation: Arc<DeactivationService>,
    timing: RefreshTiming,
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
            timing: RefreshTiming::default(),
        }
    }

    #[cfg(test)]
    fn with_timing(mut self, timing: RefreshTiming) -> Self {
        self.timing = timing;
        self
    }

    pub fn start(&self) {
        let auth_service = self.auth_service.clone();
        let config_service = self.config_service.clone();
        let deactivation = self.deactivation.clone();
        let timing = self.timing;

        info!("Starting proactive token refresh run manager");

        tokio::spawn(async move {
            let mut schedule = match config_service.get_access_token().await {
                Ok(token) if !token.is_empty() => {
                    schedule_for_existing(&timing, &token, Utc::now().timestamp(), Instant::now())
                }
                Ok(_) => RefreshSchedule::now(),
                Err(e) => {
                    warn!(
                        "Token refresh: cannot read access token ({e:#}); using fallback interval"
                    );
                    RefreshSchedule::after(
                        Instant::now(),
                        Utc::now().timestamp(),
                        timing.fallback_interval,
                        Duration::ZERO,
                    )
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
                        timeout(timing.reauth_timeout, auth_service.reauthenticate()).await
                    {
                        schedule = schedule_after_refresh(
                            &timing,
                            &response,
                            Utc::now().timestamp(),
                            Instant::now(),
                        );
                    }
                    continue;
                }

                schedule.wait(timing.wait_slice).await;

                // Retry on the short interval until a refresh succeeds.
                loop {
                    match timeout(timing.reauth_timeout, auth_service.reauthenticate()).await {
                        Ok(Ok(response)) => {
                            schedule = schedule_after_refresh(
                                &timing,
                                &response,
                                Utc::now().timestamp(),
                                Instant::now(),
                            );
                            info!("Proactively refreshed access token; shared_token.enc updated");
                            break;
                        }
                        Ok(Err(e)) => error!(
                            "Proactive token refresh failed: {e:#}; retrying in {}s",
                            timing.retry_interval.as_secs()
                        ),
                        Err(_) => error!(
                            "Proactive token refresh timed out after {}s; retrying in {}s",
                            timing.reauth_timeout.as_secs(),
                            timing.retry_interval.as_secs()
                        ),
                    }
                    // Tenant went gone mid-retry — hand control to the backoff probe above.
                    if deactivation.is_suspended() {
                        schedule = RefreshSchedule::now();
                        break;
                    }
                    sleep(timing.retry_interval).await;
                }
            }
        });
    }
}

/// When the next refresh is due: the same delay on both clocks. `due_at` (monotonic) can't be moved by
/// a wall-clock jump; `due_wall` (device wall-clock seconds) catches a resume from suspend, where the
/// monotonic clock may have stood still. `not_before` floors either trigger.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RefreshSchedule {
    not_before: Instant,
    due_at: Instant,
    due_wall: i64,
}

impl RefreshSchedule {
    fn after(now_mono: Instant, now_wall: i64, delay: Duration, floor: Duration) -> Self {
        // Whole seconds rounded up, so the wall deadline never precedes the monotonic one.
        let delay_secs = delay.as_secs() + u64::from(delay.subsec_nanos() > 0);
        Self {
            not_before: now_mono + floor,
            due_at: now_mono + delay,
            due_wall: now_wall.saturating_add(delay_secs as i64),
        }
    }

    fn now() -> Self {
        Self::after(
            Instant::now(),
            Utc::now().timestamp(),
            Duration::ZERO,
            Duration::ZERO,
        )
    }

    /// Sleep until due, in slices so a wall-clock jump past the deadline is caught within a slice.
    async fn wait(&self, slice: Duration) {
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
            if remaining.is_zero() || Utc::now().timestamp() >= self.due_wall {
                return;
            }
            sleep(remaining.min(slice)).await;
        }
    }
}

impl RefreshTiming {
    /// Full margin normally; `min_lead` for a short-lived token.
    fn lead_for(&self, ttl: Duration) -> Duration {
        if ttl > self.margin {
            self.margin
        } else {
            self.min_lead
        }
    }

    fn ttl_from_secs(&self, secs: i64) -> Duration {
        Duration::from_secs(secs as u64).min(self.max_ttl)
    }
}

/// Schedule after a successful refresh: the server-granted lifetime counted from receipt, never sooner than `min_interval`.
fn schedule_after_refresh(
    timing: &RefreshTiming,
    response: &AgentTokenResponse,
    now_wall: i64,
    now_mono: Instant,
) -> RefreshSchedule {
    let times = jwt::token_times_unix(&response.access_token);
    let ttl = response
        .expires_in
        .filter(|secs| *secs > 0)
        .or_else(|| times.and_then(|t| t.ttl_secs()))
        .map(|secs| timing.ttl_from_secs(secs));
    let delay = match ttl {
        Some(ttl) => ttl
            .saturating_sub(timing.lead_for(ttl))
            .max(timing.min_interval),
        None => {
            warn!("Token refresh: token lifetime unknown; using fallback interval");
            timing.fallback_interval
        }
    };

    // Device clock minus server clock, measured against the freshly minted `iat`.
    if let Some(skew) = times.and_then(|t| t.iat).map(|iat| now_wall - iat) {
        if skew.unsigned_abs() >= SKEW_WARN.as_secs() {
            warn!(
                skew_s = skew,
                "Device clock differs from the server; refresh timing is taken from the token lifetime"
            );
        }
    }

    RefreshSchedule::after(now_mono, now_wall, delay, timing.min_interval)
}

/// Schedule for the token found at startup: its receipt time is unknown, so the device clock estimates the
/// remaining life, trusted only within the token's own lifetime — a skewed clock costs at most one early refresh.
fn schedule_for_existing(
    timing: &RefreshTiming,
    token: &str,
    now_wall: i64,
    now_mono: Instant,
) -> RefreshSchedule {
    let Some(times) = jwt::token_times_unix(token) else {
        warn!("Token refresh: access token has no decodable exp; using fallback interval");
        return RefreshSchedule::after(
            now_mono,
            now_wall,
            timing.fallback_interval,
            Duration::ZERO,
        );
    };
    let Some(ttl) = times.ttl_secs().map(|secs| timing.ttl_from_secs(secs)) else {
        return RefreshSchedule::after(now_mono, now_wall, Duration::ZERO, Duration::ZERO);
    };
    let remaining = times.exp - now_wall;
    // More life left than the token ever had: the clock is behind and the real remainder is unknowable.
    let delay = if remaining > ttl.as_secs() as i64 {
        Duration::ZERO
    } else {
        Duration::from_secs(remaining.max(0) as u64).saturating_sub(timing.lead_for(ttl))
    };
    RefreshSchedule::after(now_mono, now_wall, delay, Duration::ZERO)
}

#[cfg(test)]
#[path = "token_refresh_run_manager_tests.rs"]
mod tests;
