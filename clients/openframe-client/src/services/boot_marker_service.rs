use crate::platform::directories::DirectoryManager;
use crate::utils::fs::atomic_write;
use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

const CLIENT_UPDATE_DELEGATED_FILE_NAME: &str = "client_update_delegated";

/// Writes `{secured}/boot.marker` with the running version on every boot: openframe-client-updater
/// verifies a swapped binary by it, as did the update scripts of earlier clients.
#[derive(Clone)]
pub struct BootMarkerService {
    boot_marker_path: PathBuf,
    delegation_marker_path: PathBuf,
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
            delegation_marker_path: directory_manager
                .secured_dir()
                .join(CLIENT_UPDATE_DELEGATED_FILE_NAME),
            legacy_artifacts: legacy_last_known_good_artifacts(
                directory_manager.secured_dir(),
                &current_exe,
            ),
        })
    }

    /// Hands this client's updates to openframe-client-updater, then writes the boot marker. The
    /// updater acts only while both carry the same version, so it leaves an older client that still
    /// updates itself alone, including one that a downgrade brought back.
    pub async fn write_boot_marker(&self) -> Result<()> {
        write_version(&self.delegation_marker_path)?;
        write_version(&self.boot_marker_path)?;
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

fn write_version(path: &Path) -> Result<()> {
    atomic_write(path, env!("OPENFRAME_VERSION"))
        .with_context(|| format!("Failed to write marker: {:?}", path))
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
