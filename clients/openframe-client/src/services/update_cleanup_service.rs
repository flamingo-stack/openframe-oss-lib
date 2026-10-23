use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tracing::{info, warn};

use crate::config::update_config::TEMP_LEFTOVER_MIN_AGE_SECS;

#[derive(Clone)]
pub struct UpdateCleanupService {
    exe_path: PathBuf,
}

impl UpdateCleanupService {
    pub fn new() -> Result<Self> {
        let exe_path = std::env::current_exe().context("Failed to get current executable path")?;
        Ok(Self::for_binary(exe_path))
    }

    /// For an uninstall started from a copy that is not the installed binary.
    pub fn for_binary(exe_path: PathBuf) -> Self {
        Self { exe_path }
    }

    /// Routine sweep after an update: old backups next to the binary and temp
    /// leftovers older than TEMP_LEFTOVER_MIN_AGE_SECS.
    pub async fn cleanup_all(&self) {
        let mut cleaned = 0;

        match self.cleanup_all_old_backups() {
            Ok(count) => cleaned += count,
            Err(e) => warn!("Failed to cleanup old backups: {:#}", e),
        }

        cleaned += self.sweep_temp_leftovers(Some(Duration::from_secs(TEMP_LEFTOVER_MIN_AGE_SECS)));

        if cleaned > 0 {
            info!("Cleanup: removed {} old files", cleaned);
        }
    }

    /// The pre-swap copy is only needed until the new binary has verified its
    /// boot; after promotion nothing reads it.
    pub fn remove_pre_swap_copy(&self) {
        let mut prev = self.exe_path.clone().into_os_string();
        prev.push(".prev");
        let prev = PathBuf::from(prev);
        if !prev.exists() {
            return;
        }
        match fs::remove_file(&prev) {
            Ok(()) => info!("Removed pre-swap copy: {}", prev.display()),
            Err(e) => warn!("Failed to remove pre-swap copy {}: {}", prev.display(), e),
        }
    }

    fn cleanup_all_old_backups(&self) -> Result<usize> {
        let exe_dir = self
            .exe_path
            .parent()
            .context("Failed to get executable directory")?;
        let exe_name = self
            .exe_path
            .file_name()
            .context("Failed to get executable name")?
            .to_string_lossy();
        let backup_pattern = format!("{}.backup.", exe_name);

        let mut cleaned = 0;
        for path in Self::matching_entries(exe_dir, |name| name.starts_with(&backup_pattern)) {
            match fs::remove_file(&path) {
                Ok(()) => {
                    info!("Removed old backup: {}", path.display());
                    cleaned += 1;
                }
                Err(e) => warn!("Failed to remove backup {}: {}", path.display(), e),
            }
        }
        Ok(cleaned)
    }

    /// Temp-dir leftovers of the script-based updater (`openframe-update-*`
    /// staging dirs, `openframe-updater-*.ps1|.sh`). `min_age` = `None` removes
    /// them regardless of age (uninstall); otherwise anything younger is kept
    /// because an update may still be using it.
    pub fn sweep_temp_leftovers(&self, min_age: Option<Duration>) -> usize {
        let temp_dir = std::env::temp_dir();
        let mut cleaned = 0;
        let Ok(entries) = fs::read_dir(&temp_dir) else {
            return 0;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let is_update_artifact = name.starts_with("openframe-update-")
                || (name.starts_with("openframe-updater-")
                    && (name.ends_with(".ps1") || name.ends_with(".sh")));
            if !is_update_artifact {
                continue;
            }

            if let Some(min_age) = min_age {
                let too_fresh = entry
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.elapsed().ok())
                    .map(|age| age < min_age)
                    .unwrap_or(true);
                if too_fresh {
                    continue;
                }
            }

            let path = entry.path();
            let result = if path.is_dir() {
                fs::remove_dir_all(&path)
            } else {
                fs::remove_file(&path)
            };
            match result {
                Ok(()) => {
                    info!("Removed update leftover: {}", path.display());
                    cleaned += 1;
                }
                Err(e) => warn!("Failed to remove update leftover {}: {}", path.display(), e),
            }
        }
        cleaned
    }

    fn matching_entries(dir: &Path, matches: impl Fn(&str) -> bool) -> Vec<PathBuf> {
        let Ok(entries) = fs::read_dir(dir) else {
            return Vec::new();
        };
        entries
            .flatten()
            .filter(|e| matches(&e.file_name().to_string_lossy()))
            .map(|e| e.path())
            .collect()
    }
}

#[cfg(test)]
#[path = "update_cleanup_service_tests.rs"]
mod tests;
