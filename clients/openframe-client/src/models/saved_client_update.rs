use super::openframe_client_update_message::OpenFrameClientUpdateMessage;
use crate::config::update_config::{SAVED_UPDATE_MAX_AGE_SECS, SAVED_UPDATE_RETRY_DELAYS_SECS};
use crate::utils::version_comparator;
use serde::{Deserialize, Serialize};

/// A legacy client update message kept on disk until it applies, so a failed attempt is retried.
/// Times are unix seconds.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedClientUpdate {
    pub message: OpenFrameClientUpdateMessage,
    pub received_at: u64,
    #[serde(default)]
    pub attempts: u32,
    #[serde(default)]
    pub next_attempt_at: u64,
}

impl SavedClientUpdate {
    pub fn new(message: OpenFrameClientUpdateMessage, now: u64) -> Self {
        Self {
            message,
            received_at: now,
            attempts: 0,
            next_attempt_at: now,
        }
    }

    pub fn version(&self) -> &str {
        self.message.version.trim()
    }

    /// Also due when the next attempt is further out than any delay allows, i.e. the clock went back
    pub fn is_due(&self, now: u64) -> bool {
        now >= self.next_attempt_at || self.next_attempt_at > now + Self::longest_delay()
    }

    /// Counts an attempt and schedules the next one
    pub fn start_attempt(&mut self, now: u64) {
        let step = (self.attempts as usize).min(SAVED_UPDATE_RETRY_DELAYS_SECS.len() - 1);
        self.attempts += 1;
        self.next_attempt_at = now + SAVED_UPDATE_RETRY_DELAYS_SECS[step];
    }

    pub fn is_expired(&self, now: u64) -> bool {
        now.saturating_sub(self.received_at) >= SAVED_UPDATE_MAX_AGE_SECS
    }

    /// Compared as semver, so "v1.2.3" and "1.2.3" are the same release
    pub fn targets(&self, version: &str) -> bool {
        let version = version.trim();
        match (
            version_comparator::parse_version(self.version()),
            version_comparator::parse_version(version),
        ) {
            (Some(saved), Some(other)) => saved == other,
            _ => self.version() == version,
        }
    }

    fn longest_delay() -> u64 {
        SAVED_UPDATE_RETRY_DELAYS_SECS[SAVED_UPDATE_RETRY_DELAYS_SECS.len() - 1]
    }
}

#[cfg(test)]
#[path = "saved_client_update_tests.rs"]
mod tests;
