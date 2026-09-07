use std::sync::Arc;

use chrono::Utc;
use tokio::time::{sleep, timeout, Duration};
use tracing::{debug, error, info, warn};

use crate::models::AgentTokenResponse;
use crate::services::deactivation_service::DeactivationService;
use crate::services::AgentAuthService;
use crate::utils::jwt;

/// Device-vs-server clock difference worth a warning.
const SKEW_WARN: Duration = Duration::from_secs(5 * 60);

/// Time since boot on a clock that keeps counting through sleep and hibernation. `Instant` does not on macOS
/// (`CLOCK_UPTIME_RAW`) and Linux (`CLOCK_MONOTONIC`), so a deadline kept on it would slip by the length of every nap.
mod boot_clock {
    use std::time::Duration;

    #[cfg(any(target_os = "linux", target_vendor = "apple"))]
    pub fn now() -> Duration {
        // Linux counts sleep on CLOCK_BOOTTIME; Apple's CLOCK_MONOTONIC does too (only CLOCK_UPTIME_RAW stops).
        #[cfg(target_os = "linux")]
        let id = libc::CLOCK_BOOTTIME;
        #[cfg(target_vendor = "apple")]
        let id = libc::CLOCK_MONOTONIC;
        let mut ts = libc::timespec {
            tv_sec: 0,
            tv_nsec: 0,
        };
        // SAFETY: `ts` is a valid out-pointer for the duration of the call and `id` is a supported clock.
        let rc = unsafe { libc::clock_gettime(id, &mut ts) };
        debug_assert_eq!(rc, 0, "clock_gettime failed");
        Duration::new(
            ts.tv_sec.max(0) as u64,
            ts.tv_nsec.clamp(0, 999_999_999) as u32,
        )
    }

    /// `Instant` is `QueryPerformanceCounter`, which Windows documents as counting through standby and hibernation.
    #[cfg(not(any(target_os = "linux", target_vendor = "apple")))]
    pub fn now() -> Duration {
        use std::sync::OnceLock;
        use std::time::Instant;
        static START: OnceLock<Instant> = OnceLock::new();
        START.get_or_init(Instant::now).elapsed()
    }
}

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
    /// Floor between two refreshes whatever the token says — the guard against a hot loop.
    min_interval: Duration,
    /// The wait is sliced so the boot clock is re-read after a sleep the tokio timer did not count.
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
            min_lead: Duration::from_secs(30),
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
    deactivation: Arc<DeactivationService>,
    timing: RefreshTiming,
}

impl TokenRefreshRunManager {
    pub fn new(auth_service: AgentAuthService, deactivation: Arc<DeactivationService>) -> Self {
        Self {
            auth_service,
            deactivation,
            timing: RefreshTiming::default(),
        }
    }

    pub fn start(&self) {
        let auth_service = self.auth_service.clone();
        let deactivation = self.deactivation.clone();
        let timing = self.timing;

        info!("Starting proactive token refresh run manager");

        tokio::spawn(async move {
            // Refresh once at start: the stored token's remaining life is unknowable without trusting the
            // device clock, and shared_token.enc must be valid before the tools connect.
            let mut schedule = RefreshSchedule::now();

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
                    let (sent_wall, sent_boot) = (Utc::now().timestamp(), boot_clock::now());
                    if let Ok(Ok(response)) =
                        timeout(timing.reauth_timeout, auth_service.reauthenticate()).await
                    {
                        schedule = schedule_after_refresh(&timing, &response, sent_wall, sent_boot);
                    }
                    continue;
                }

                schedule.wait(timing.wait_slice).await;

                // Retry on the short interval until a refresh succeeds.
                loop {
                    let (sent_wall, sent_boot) = (Utc::now().timestamp(), boot_clock::now());
                    match timeout(timing.reauth_timeout, auth_service.reauthenticate()).await {
                        Ok(Ok(response)) => {
                            schedule =
                                schedule_after_refresh(&timing, &response, sent_wall, sent_boot);
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

/// When the next refresh is due, on the boot clock: the token's lifetime counted from the request, unmoved by
/// wall-clock steps and still counting through sleep.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RefreshSchedule {
    due: Duration,
}

impl RefreshSchedule {
    fn after(now_boot: Duration, delay: Duration) -> Self {
        Self {
            due: now_boot.saturating_add(delay),
        }
    }

    fn now() -> Self {
        Self::after(boot_clock::now(), Duration::ZERO)
    }

    /// Sleep until due, in slices: tokio timers run on `Instant`, which stands still through sleep on macOS and
    /// Linux, so the boot clock is re-read after every slice and a nap costs at most one slice of lateness.
    async fn wait(&self, slice: Duration) {
        let remaining = self.due.saturating_sub(boot_clock::now());
        if !remaining.is_zero() {
            debug!("Next proactive token refresh in {}s", remaining.as_secs());
        }
        loop {
            let remaining = self.due.saturating_sub(boot_clock::now());
            if remaining.is_zero() {
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

/// Schedule after a successful refresh: the server-granted lifetime counted from the moment the request was
/// sent (`sent_boot`, so latency shortens the lead rather than the token), never sooner than `min_interval`.
/// `sent_wall` only feeds the clock-skew warning.
fn schedule_after_refresh(
    timing: &RefreshTiming,
    response: &AgentTokenResponse,
    sent_wall: i64,
    sent_boot: Duration,
) -> RefreshSchedule {
    let times = jwt::token_times_unix(&response.access_token);
    // The shorter of `expires_in` and `exp - iat`, so neither claim alone can stretch the interval.
    let ttl = match (
        response.expires_in.filter(|secs| *secs > 0),
        times.and_then(|t| t.ttl_secs()),
    ) {
        (Some(declared), Some(claimed)) => Some(declared.min(claimed)),
        (declared, claimed) => declared.or(claimed),
    }
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
    if let Some(skew) = times
        .and_then(|t| t.iat)
        .and_then(|iat| sent_wall.checked_sub(iat))
    {
        if skew.unsigned_abs() >= SKEW_WARN.as_secs() {
            warn!(
                skew_s = skew,
                "Device clock differs from the server; refresh timing is taken from the token lifetime"
            );
        }
    }

    RefreshSchedule::after(sent_boot, delay)
}

#[cfg(test)]
#[path = "token_refresh_run_manager_tests.rs"]
mod tests;
