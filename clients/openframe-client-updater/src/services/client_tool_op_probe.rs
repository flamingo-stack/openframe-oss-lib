use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tracing::{info, warn};

use crate::config::updater_config::{
    TOOL_OPS_IN_FLIGHT_FILE_NAME, TOOL_OPS_IN_FLIGHT_STALE_SECS,
    TOOL_OP_QUIESCE_POLL_INTERVAL_SECS, TOOL_OP_QUIESCE_WAIT_SECS,
};
use crate::platform::DirectoryManager;

/// Reads the tool-operation marker openframe-client keeps at
/// {secured}/tool_ops_in_flight.json — a JSON array of the tool ids with an
/// install/update/uninstall/restart in progress. The client removes the file
/// when the last operation finishes and on every boot, so a marker older than
/// TOOL_OPS_IN_FLIGHT_STALE_SECS can only be left by a client that died mid-op.
#[derive(Clone)]
pub struct ClientToolOpProbe {
    marker_path: PathBuf,
}

impl ClientToolOpProbe {
    pub fn new(directory_manager: &DirectoryManager) -> Self {
        Self::from_path(
            directory_manager
                .secured_dir()
                .join(TOOL_OPS_IN_FLIGHT_FILE_NAME),
        )
    }

    pub fn from_path(marker_path: PathBuf) -> Self {
        Self { marker_path }
    }

    pub fn in_flight_tool_ops(&self) -> Vec<String> {
        let Ok(metadata) = fs::metadata(&self.marker_path) else {
            return Vec::new();
        };
        if let Ok(Ok(age)) = metadata.modified().map(|m| m.elapsed()) {
            if age.as_secs() > TOOL_OPS_IN_FLIGHT_STALE_SECS {
                return Vec::new();
            }
        }
        let Ok(raw) = fs::read_to_string(&self.marker_path) else {
            return Vec::new();
        };
        match serde_json::from_str::<Vec<String>>(&raw) {
            Ok(ids) => ids,
            Err(e) => {
                warn!(
                    "Ignoring unreadable tool-op marker {}: {}",
                    self.marker_path.display(),
                    e
                );
                Vec::new()
            }
        }
    }

    /// Waits up to TOOL_OP_QUIESCE_WAIT_SECS for the client's tool operations
    /// to drain. Returns the ids still in flight when the wait runs out.
    pub async fn wait_for_quiescence(&self) -> Result<(), Vec<String>> {
        let mut elapsed = 0u64;
        loop {
            let busy = self.in_flight_tool_ops();
            if busy.is_empty() {
                return Ok(());
            }
            if elapsed >= TOOL_OP_QUIESCE_WAIT_SECS {
                return Err(busy);
            }
            info!(
                "Client tool operations in flight ({}) — waiting before stopping the client ({}s/{}s)",
                busy.join(", "),
                elapsed,
                TOOL_OP_QUIESCE_WAIT_SECS
            );
            tokio::time::sleep(Duration::from_secs(TOOL_OP_QUIESCE_POLL_INTERVAL_SECS)).await;
            elapsed += TOOL_OP_QUIESCE_POLL_INTERVAL_SECS;
        }
    }
}

#[cfg(test)]
#[path = "client_tool_op_probe_tests.rs"]
mod tests;
