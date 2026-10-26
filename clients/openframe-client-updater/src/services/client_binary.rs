use std::fs;
use std::path::Path;
use tracing::{error, info, warn};

use crate::config::updater_config::{
    BACKUP_RESTORE_ATTEMPTS, BACKUP_RESTORE_RETRY_DELAY_SECS, CLIENT_SERVICE_FULL_NAME,
};
use crate::platform::atomic_replace;
use crate::services::boot_marker_service::BootMarkerService;
use crate::services::service_manager_service::ServiceManagerService;
use crate::utils::blocking::run_blocking;

/// How putting the pre-swap binary back ended.
#[derive(Debug, PartialEq)]
pub enum Restore {
    Restored,
    /// The previous binary is back but its service did not start.
    RestoredNotStarted(String),
    Failed,
}

/// The one way back from a failed swap, shared by updates and crash recovery:
/// stop whatever client runs, put the pre-swap binary back and start it.
pub async fn restore_previous_binary(
    backup: &Path,
    target: &Path,
    boot_marker: &BootMarkerService,
) -> Restore {
    // The bad binary may still run (e.g. it booted but reported the wrong
    // version); a state that can't be read is stopped too, so the restore never
    // renames over a live process.
    if ServiceManagerService::query_running(CLIENT_SERVICE_FULL_NAME).await != Some(false) {
        if let Err(e) = ServiceManagerService::stop_async(CLIENT_SERVICE_FULL_NAME).await {
            warn!(
                "Failed to stop the client before restoring the backup: {:#}",
                e
            );
        }
    }

    if !restore_backup_file(backup, target).await {
        return Restore::Failed;
    }

    // The failed binary may have left a marker with the target version; crash
    // recovery must not read it as the update having booted.
    if let Err(e) = boot_marker.clear_boot_marker() {
        warn!(
            "Failed to clear boot marker before restarting the previous binary: {:#}",
            e
        );
    }

    match ServiceManagerService::start_async(CLIENT_SERVICE_FULL_NAME).await {
        Ok(()) => Restore::Restored,
        Err(e) => {
            error!("Failed to start the restored client: {:#}", e);
            Restore::RestoredNotStarted(format!("{:#}", e))
        }
    }
}

/// Renames the backup over `target`, retrying while the file is briefly locked (AV, SCM).
async fn restore_backup_file(backup: &Path, target: &Path) -> bool {
    if !backup.exists() {
        error!("No pre-swap backup to restore at {}", backup.display());
        return false;
    }
    for attempt in 1..=BACKUP_RESTORE_ATTEMPTS {
        let (from, to) = (backup.to_path_buf(), target.to_path_buf());
        match run_blocking(move || atomic_replace::restore(&from, &to)).await {
            Ok(()) => {
                info!("Restored client binary from {}", backup.display());
                return true;
            }
            Err(e) => {
                warn!(
                    "Restore attempt {}/{} from {} failed: {:#}",
                    attempt,
                    BACKUP_RESTORE_ATTEMPTS,
                    backup.display(),
                    e
                );
                if attempt < BACKUP_RESTORE_ATTEMPTS {
                    tokio::time::sleep(tokio::time::Duration::from_secs(
                        BACKUP_RESTORE_RETRY_DELAY_SECS,
                    ))
                    .await;
                }
            }
        }
    }
    false
}

pub fn remove_quietly(path: &Path, what: &str) {
    if !path.exists() {
        return;
    }
    if let Err(e) = fs::remove_file(path) {
        warn!("Failed to remove {} {}: {}", what, path.display(), e);
    }
}

/// Removes staged binaries and pre-swap backups that an interrupted update
/// left next to `target`. Only safe while no update is in flight.
pub fn sweep_leftovers(target: &Path) {
    let (Some(dir), Some(name)) = (target.parent(), target.file_name()) else {
        return;
    };
    let backup_prefix = format!("{}.backup.", name.to_string_lossy());
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        let staged =
            file_name.starts_with(atomic_replace::TEMP_PREFIX) && file_name.ends_with(".tmp");
        if !staged && !file_name.starts_with(&backup_prefix) {
            continue;
        }
        let path = entry.path();
        match fs::remove_file(&path) {
            Ok(()) => info!("Removed update leftover {}", path.display()),
            Err(e) => warn!("Failed to remove update leftover {}: {}", path.display(), e),
        }
    }
}

#[cfg(test)]
#[path = "client_binary_tests.rs"]
mod tests;
