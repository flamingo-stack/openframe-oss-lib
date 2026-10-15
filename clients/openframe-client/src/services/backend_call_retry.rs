use std::future::Future;

use anyhow::Result;
use tokio::time::{sleep, Duration};
use tracing::warn;

use crate::services::deactivation_service::DeactivationService;

/// Delays between attempts: `initial` after the first failure, doubling up to `max`.
#[derive(Debug, Clone, Copy)]
pub(crate) struct RetryTiming {
    pub(crate) initial: Duration,
    pub(crate) max: Duration,
}

impl RetryTiming {
    pub(crate) const fn fixed(interval: Duration) -> Self {
        Self {
            initial: interval,
            max: interval,
        }
    }

    fn next(self, delay: Duration) -> Duration {
        delay.saturating_mul(2).min(self.max)
    }
}

/// Runs `attempt` until it returns `Ok`, waiting while the tenant is suspended and backing off after each failure.
pub(crate) async fn retry_until_settled<T, F, Fut>(
    deactivation: &DeactivationService,
    timing: RetryTiming,
    what: &str,
    mut attempt: F,
) -> T
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let mut delay = timing.initial;
    loop {
        // Tenant gone: don't hammer the gateway; the backoff probe drives recovery.
        if deactivation.is_suspended() {
            sleep(delay).await;
            continue;
        }
        match attempt().await {
            Ok(value) => return value,
            Err(e) => {
                warn!(
                    "Failed to {}: {:#}. Retrying in {}s",
                    what,
                    e,
                    delay.as_secs()
                );
                sleep(delay).await;
                delay = timing.next(delay);
            }
        }
    }
}

#[cfg(test)]
#[path = "backend_call_retry_tests.rs"]
mod tests;
