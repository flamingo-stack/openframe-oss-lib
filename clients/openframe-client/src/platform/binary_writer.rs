use crate::config::service_stop::BINARY_SYNC_TIMEOUT_SECS;
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;
use tracing::{info, warn};

#[cfg(target_family = "unix")]
use std::os::unix::fs::PermissionsExt;

/// Path of the `.old` rename-aside `write_executable` creates when the target binary is locked.
pub fn aside_path(path: &Path) -> PathBuf {
    let mut aside = path.as_os_str().to_os_string();
    aside.push(".old");
    PathBuf::from(aside)
}

/// Write `bytes` to `path`, flushed, synced and with our handle closed on return (a timed-out sync is logged and closes it later).
pub async fn write_executable(bytes: &[u8], path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create directory: {}", parent.display()))?;
    }

    let mut file = match File::create(path).await {
        Ok(file) => file,
        Err(first_err) => {
            warn!(
                "Failed to create {}: {}. Attempting lock/permission recovery",
                path.display(),
                first_err
            );
            let _ = crate::platform::file_acl::ensure_writable(path).await;

            #[cfg(target_os = "windows")]
            {
                let aside = aside_path(path);
                let _ = fs::remove_file(&aside).await;
                match fs::rename(path, &aside).await {
                    Ok(()) => info!(
                        "Moved locked file {} aside to {}",
                        path.display(),
                        aside.display()
                    ),
                    Err(e) => warn!("Failed to move locked file {} aside: {}", path.display(), e),
                }
            }

            File::create(path).await.with_context(|| {
                format!("Failed to create file after recovery: {}", path.display())
            })?
        }
    };

    file.write_all(bytes)
        .await
        .with_context(|| format!("Failed to write file: {}", path.display()))?;
    file.flush()
        .await
        .with_context(|| format!("Failed to flush file: {}", path.display()))?;
    match tokio::time::timeout(
        Duration::from_secs(BINARY_SYNC_TIMEOUT_SECS),
        file.sync_all(),
    )
    .await
    {
        Ok(Ok(())) => {}
        Ok(Err(e)) => warn!(
            "Failed to sync {} to disk, continuing: {}",
            path.display(),
            e
        ),
        Err(_) => warn!(
            "Sync of {} to disk did not finish within {}s; continuing, the handle closes when it does",
            path.display(),
            BINARY_SYNC_TIMEOUT_SECS
        ),
    }
    // Close our handle before anything may open or execute the file.
    drop(file);

    set_executable_permissions(path).await?;

    info!("Binary written: {} ({} bytes)", path.display(), bytes.len());
    Ok(())
}

pub async fn set_executable_permissions(path: &Path) -> Result<()> {
    #[cfg(target_family = "unix")]
    {
        let mut perms = fs::metadata(path)
            .await
            .with_context(|| format!("Failed to get metadata: {}", path.display()))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(path, perms)
            .await
            .with_context(|| format!("Failed to set permissions: {}", path.display()))?;
    }

    #[cfg(not(target_family = "unix"))]
    {
        let _ = path; // suppress unused warning
    }

    Ok(())
}

/// Poll until `path` opens with no sharing, i.e. our writer and any AV scan released it; false when `max_wait` runs out.
#[cfg(target_os = "windows")]
pub async fn wait_until_executable_unlocked(path: &Path, max_wait: Duration) -> bool {
    use crate::config::service_stop::EXEC_UNLOCK_POLL_INTERVAL_MS;
    use crate::platform::file_lock::is_file_in_use_error;

    let started = std::time::Instant::now();
    let mut waited = false;
    loop {
        match exclusive_open_probe(path).await {
            Ok(()) => {
                if waited {
                    info!(
                        "{} was held for {} ms after write (writer/AV) before start",
                        path.display(),
                        started.elapsed().as_millis()
                    );
                }
                return true;
            }
            Err(e) if is_file_in_use_error(&e) => {
                if started.elapsed() >= max_wait {
                    warn!(
                        "{} still held after {} ms by {}; starting anyway",
                        path.display(),
                        started.elapsed().as_millis(),
                        locking_processes_label(path).await
                    );
                    return false;
                }
                waited = true;
                tokio::time::sleep(Duration::from_millis(EXEC_UNLOCK_POLL_INTERVAL_MS)).await;
            }
            Err(e) => {
                warn!(
                    "Exclusive-open probe of {} failed for another reason, proceeding to start: {}",
                    path.display(),
                    e
                );
                return true;
            }
        }
    }
}

/// Who holds `path` per Restart Manager; it lists processes only, so a filter-driver/AV hold shows as none.
#[cfg(target_os = "windows")]
async fn locking_processes_label(path: &Path) -> String {
    use crate::platform::file_lock::{format_locking_processes, get_locking_processes};

    let path = path.to_string_lossy().into_owned();
    match tokio::task::spawn_blocking(move || get_locking_processes(&path)).await {
        Ok(Ok(processes)) if processes.is_empty() => {
            "no process (filter driver or AV hold)".to_string()
        }
        Ok(Ok(processes)) => format_locking_processes(&processes),
        Ok(Err(e)) => format!("unknown ({e})"),
        Err(e) => format!("unknown ({e})"),
    }
}

/// One exclusive-share open off the runtime; os error 32 means the file is still held.
#[cfg(target_os = "windows")]
async fn exclusive_open_probe(path: &Path) -> std::io::Result<()> {
    use std::os::windows::fs::OpenOptionsExt;

    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || {
        std::fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&path)
            .map(drop)
    })
    .await
    .unwrap_or_else(|join_err| Err(std::io::Error::other(join_err)))
}

#[cfg(test)]
#[path = "binary_writer_tests.rs"]
mod tests;
