use crate::platform::directories::DirectoryManager;
use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

/// Writes `{secured}/boot.marker` with the running version on every boot: openframe-client-updater
/// verifies a swapped binary by it, as did the update scripts of earlier clients.
#[derive(Clone)]
pub struct BootMarkerService {
    boot_marker_path: PathBuf,
    legacy_artifacts: Vec<PathBuf>,
}

impl BootMarkerService {
    pub fn new(directory_manager: DirectoryManager) -> Result<Self> {
        directory_manager
            .ensure_directories()
            .with_context(|| "Failed to ensure secured directory exists")?;

        let current_exe =
            std::env::current_exe().context("Failed to get current executable path")?;

        Ok(Self {
            boot_marker_path: directory_manager.secured_dir().join("boot.marker"),
            legacy_artifacts: legacy_last_known_good_artifacts(
                directory_manager.secured_dir(),
                &current_exe,
            ),
        })
    }

    pub async fn write_boot_marker(&self) -> Result<()> {
        let temp_path = self.boot_marker_path.with_extension("marker.tmp");
        fs::write(&temp_path, env!("OPENFRAME_VERSION"))
            .with_context(|| format!("Failed to write temp boot marker: {:?}", temp_path))?;
        fs::rename(&temp_path, &self.boot_marker_path).with_context(|| {
            format!(
                "Failed to move boot marker into place: {:?}",
                self.boot_marker_path
            )
        })?;
        debug!("Boot marker written: {}", self.boot_marker_path.display());
        Ok(())
    }

    /// Removes the last-known-good anchor and reserve binary earlier clients kept; nothing reads them now
    pub fn remove_legacy_artifacts(&self) {
        for path in &self.legacy_artifacts {
            if !path.exists() {
                continue;
            }
            match fs::remove_file(path) {
                Ok(()) => info!("Removed legacy last-known-good file: {}", path.display()),
                Err(e) => warn!(
                    "Failed to remove legacy last-known-good file {}: {}",
                    path.display(),
                    e
                ),
            }
        }
    }
}

fn legacy_last_known_good_artifacts(secured_dir: &Path, current_exe: &Path) -> Vec<PathBuf> {
    let mut reserve = current_exe.as_os_str().to_owned();
    reserve.push(".lkg");
    let reserve = PathBuf::from(reserve);
    let anchor = secured_dir.join("last_known_good.json");
    vec![
        anchor.with_extension("json.tmp"),
        anchor,
        reserve.with_extension("lkg.tmp"),
        reserve,
    ]
}
