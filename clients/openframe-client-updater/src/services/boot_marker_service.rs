use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

use crate::platform::DirectoryManager;

/// `{secured}/boot.marker`, written by openframe-client on every boot with its
/// running version: the updater's view of the running client version, and the
/// proof that a freshly swapped binary booted.
#[derive(Clone)]
pub struct BootMarkerService {
    boot_marker_path: PathBuf,
}

impl BootMarkerService {
    pub fn new(directory_manager: &DirectoryManager) -> Self {
        Self {
            boot_marker_path: directory_manager.secured_dir().join("boot.marker"),
        }
    }

    /// Version the client reported on its most recent boot, if any.
    pub fn boot_marker_version(&self) -> Option<String> {
        let content = fs::read_to_string(&self.boot_marker_path).ok()?;
        let trimmed = content.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
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

#[cfg(test)]
#[path = "boot_marker_service_tests.rs"]
mod tests;
