use std::fs;
use std::path::PathBuf;
use tokio::time::Duration;
use tracing::{info, warn};

use crate::config::updater_config::{
    CLIENT_DRAINED_FILE_NAME, DRAIN_POLL_INTERVAL_SECS, DRAIN_WAIT_SECS,
};
use crate::platform::DirectoryManager;

/// The client's half of a swap: while the state file shows `draining` it takes no
/// new work and waits for running work as before its own restart, then writes
/// {secured}/client_drained with the update's started_at.
#[derive(Clone)]
pub struct ClientDrain {
    marker_path: PathBuf,
}

impl ClientDrain {
    pub fn new(directory_manager: &DirectoryManager) -> Self {
        Self::at(
            directory_manager
                .secured_dir()
                .join(CLIENT_DRAINED_FILE_NAME),
        )
    }

    pub fn at(marker_path: PathBuf) -> Self {
        Self { marker_path }
    }

    /// Removes a confirmation an earlier update left, so only this update's counts.
    pub fn clear(&self) {
        if let Err(e) = fs::remove_file(&self.marker_path) {
            if e.kind() != std::io::ErrorKind::NotFound {
                warn!(
                    "Failed to remove drain marker {}: {}",
                    self.marker_path.display(),
                    e
                );
            }
        }
    }

    /// Waits for the client to confirm the drain of the update started at
    /// `token`; false when the wait runs out.
    pub async fn wait(&self, token: &str) -> bool {
        let mut elapsed = 0u64;
        loop {
            if self.confirmed(token) {
                info!("Client confirmed the drain after {}s", elapsed);
                return true;
            }
            if elapsed >= DRAIN_WAIT_SECS {
                return false;
            }
            if elapsed.is_multiple_of(60) {
                info!(
                    "Waiting for openframe-client to finish running work ({}s/{}s)",
                    elapsed, DRAIN_WAIT_SECS
                );
            }
            tokio::time::sleep(Duration::from_secs(DRAIN_POLL_INTERVAL_SECS)).await;
            elapsed += DRAIN_POLL_INTERVAL_SECS;
        }
    }

    fn confirmed(&self, token: &str) -> bool {
        fs::read_to_string(&self.marker_path)
            .map(|content| content.trim() == token)
            .unwrap_or(false)
    }
}

#[cfg(test)]
#[path = "client_drain_tests.rs"]
mod tests;
