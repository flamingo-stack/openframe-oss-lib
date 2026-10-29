use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

use crate::config::updater_config::CLIENT_UPDATE_DELEGATED_FILE_NAME;
use crate::platform::DirectoryManager;

/// `{secured}/boot.marker`, written by openframe-client on every boot with its
/// running version: the updater's view of the running client version, and the
/// proof that a freshly swapped binary booted.
#[derive(Clone)]
pub struct BootMarkerService {
    boot_marker_path: PathBuf,
    delegation_marker_path: PathBuf,
}

impl BootMarkerService {
    pub fn new(directory_manager: &DirectoryManager) -> Self {
        let secured = directory_manager.secured_dir();
        Self {
            boot_marker_path: secured.join("boot.marker"),
            delegation_marker_path: secured.join(CLIENT_UPDATE_DELEGATED_FILE_NAME),
        }
    }

    /// Version the client reported on its most recent boot, if any.
    pub fn boot_marker_version(&self) -> Option<String> {
        read_version(&self.boot_marker_path)
    }

    /// True when the running client handed its updates to the updater: it wrote
    /// the delegation marker with the version it booted with. False for an older
    /// client that still updates itself, including one a downgrade brought back.
    pub fn client_delegates_updates(&self) -> bool {
        match (
            read_version(&self.delegation_marker_path),
            self.boot_marker_version(),
        ) {
            (Some(delegated), Some(booted)) => delegated == booted,
            _ => false,
        }
    }

    /// Remove the boot marker so the next marker observed is from the new binary.
    pub fn clear_boot_marker(&self) -> Result<()> {
        if self.boot_marker_path.exists() {
            fs::remove_file(&self.boot_marker_path).with_context(|| {
                format!(
                    "Failed to remove boot marker: {}",
                    self.boot_marker_path.display()
                )
            })?;
        }
        Ok(())
    }
}

fn read_version(path: &Path) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    let trimmed = content.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
#[path = "boot_marker_service_tests.rs"]
mod tests;
