use anyhow::{anyhow, Context, Result};
use std::os::unix::fs::PermissionsExt;
use std::process::Command;
use tracing::info;
use uuid::Uuid;

use super::{LaunchedUpdater, UpdaterParams};
use crate::config::update_config::BOOT_MARKER_WAIT_SECS;
use crate::platform::update_scripts::{UPDATER_PLIST_TEMPLATE, UPDATE_SCRIPT_MACOS};

/// Launch bash updater script on macOS
/// Creates a temporary launchd job to ensure the script survives service stop
pub async fn launch_updater(params: UpdaterParams) -> Result<LaunchedUpdater> {
    info!("Launching macOS bash updater");

    let script_path = std::env::temp_dir().join(format!("openframe-updater-{}.sh", Uuid::new_v4()));

    tokio::fs::write(&script_path, UPDATE_SCRIPT_MACOS)
        .await
        .context("Failed to write bash script")?;

    // Make script executable
    let mut perms = std::fs::metadata(&script_path)?.permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(&script_path, perms)
        .context("Failed to set script executable permissions")?;

    info!("Bash script saved to: {}", script_path.display());

    info!(
        "Launching updater with: binary={}, service={}, target={}, state={}",
        params.binary_path.display(),
        params.service_name,
        params.target_exe.display(),
        params.update_state_path
    );

    // Create a temporary plist to run the update script as a one-shot launchd job
    // This ensures the script survives when our service is stopped
    // Use a per-invocation filename to avoid races with concurrent update attempts
    let plist_path =
        std::env::temp_dir().join(format!("com.openframe.updater-{}.plist", Uuid::new_v4()));

    // Remove any leftover updater job from a previous failed update
    let _ = Command::new("launchctl")
        .arg("remove")
        .arg("com.openframe.updater")
        .output();

    let plist_content = UPDATER_PLIST_TEMPLATE
        .replace("{SCRIPT_PATH}", &script_path.to_string_lossy())
        .replace("{BINARY_PATH}", &params.binary_path.to_string_lossy())
        .replace("{SERVICE_LABEL}", &params.service_name)
        .replace("{TARGET_EXE}", &params.target_exe.to_string_lossy())
        .replace("{UPDATE_STATE_PATH}", &params.update_state_path)
        .replace("{TARGET_VERSION}", &params.target_version)
        .replace(
            "{BOOT_MARKER_PATH}",
            &params.boot_marker_path.to_string_lossy(),
        )
        .replace("{LKG_PATH}", &params.lkg_path.to_string_lossy())
        .replace(
            "{BOOT_MARKER_WAIT_SECS}",
            &BOOT_MARKER_WAIT_SECS.to_string(),
        )
        .replace(
            "{ROLLBACK_ONLY}",
            if params.rollback_only { "1" } else { "0" },
        )
        .replace(
            "{TRANSCRIPT_PATH}",
            &params.transcript_path.to_string_lossy(),
        );

    if let Err(e) = std::fs::write(&plist_path, &plist_content) {
        let _ = std::fs::remove_file(&script_path);
        return Err(e).context("Failed to write updater plist");
    }

    info!("Updater plist created at: {}", plist_path.display());

    // Load the plist to start the updater job
    let output = Command::new("launchctl")
        .arg("load")
        .arg(&plist_path)
        .output()
        .context("Failed to load updater plist");

    let output = match output {
        Ok(output) => output,
        Err(e) => {
            let _ = std::fs::remove_file(&plist_path);
            let _ = std::fs::remove_file(&script_path);
            return Err(e).context("Failed to load updater plist");
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = std::fs::remove_file(&plist_path);
        let _ = std::fs::remove_file(&script_path);
        return Err(anyhow!("Failed to load updater plist: {}", stderr));
    }

    // The plist has served its purpose once loaded; launchd reads it once at load
    // time and does not need the file to persist. Remove it now to avoid leaving
    // stray files in /tmp. The script itself is still needed by the launchd job,
    // so it is intentionally left for the job to execute and clean up.
    let _ = std::fs::remove_file(&plist_path);

    info!("macOS bash updater launched via launchd");

    // launchd owns the job, so an early exit is only noticed on the next boot
    Ok(LaunchedUpdater { exit_watch: None })
}
