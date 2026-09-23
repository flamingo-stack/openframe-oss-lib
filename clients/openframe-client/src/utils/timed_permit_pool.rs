use std::sync::Arc;
use std::time::Duration;

use thiserror::Error;
use tokio::sync::Semaphore;

/// Why a pooled call produced no value.
#[derive(Debug, Error)]
pub enum PermitPoolError {
    #[error("{what} not attempted: all {max} call slots busy")]
    Busy { what: String, max: usize },
    #[error("{what} not attempted: permit pool closed: {source}")]
    Closed {
        what: String,
        source: tokio::sync::AcquireError,
    },
    #[error("{what} timed out after {ms}ms")]
    TimedOut { what: String, ms: u128 },
    #[error("{what} task failed: {source}")]
    TaskFailed {
        what: String,
        source: tokio::task::JoinError,
    },
}

impl PermitPoolError {
    /// True when no call was issued, so no blocking thread is parked and a retry costs the pool nothing.
    pub fn is_busy(&self) -> bool {
        matches!(self, Self::Busy { .. })
    }
}

/// Runs blocking closures off-runtime under a timeout, with a permit pool bounding how many threads timed-out (abandoned) calls can leave parked.
pub struct TimedPermitPool {
    permits: Arc<Semaphore>,
    max: usize,
}

impl TimedPermitPool {
    pub fn new(max: usize) -> Self {
        Self {
            permits: Arc::new(Semaphore::new(max)),
            max,
        }
    }

    /// Fails fast when no permit frees within the timeout; the permit rides inside the closure so it releases only when the blocking call actually returns.
    pub async fn call<T, F>(
        &self,
        what: &str,
        timeout: Duration,
        f: F,
    ) -> Result<T, PermitPoolError>
    where
        F: FnOnce() -> T + Send + 'static,
        T: Send + 'static,
    {
        let permit = match tokio::time::timeout(timeout, self.permits.clone().acquire_owned()).await
        {
            Err(_elapsed) => {
                return Err(PermitPoolError::Busy {
                    what: what.to_string(),
                    max: self.max,
                })
            }
            Ok(Err(source)) => {
                return Err(PermitPoolError::Closed {
                    what: what.to_string(),
                    source,
                })
            }
            Ok(Ok(permit)) => permit,
        };
        match tokio::time::timeout(
            timeout,
            tokio::task::spawn_blocking(move || {
                let _permit = permit;
                f()
            }),
        )
        .await
        {
            Err(_elapsed) => Err(PermitPoolError::TimedOut {
                what: what.to_string(),
                ms: timeout.as_millis(),
            }),
            Ok(Err(source)) => Err(PermitPoolError::TaskFailed {
                what: what.to_string(),
                source,
            }),
            Ok(Ok(v)) => Ok(v),
        }
    }
}

#[cfg(test)]
#[path = "timed_permit_pool_tests.rs"]
mod tests;
