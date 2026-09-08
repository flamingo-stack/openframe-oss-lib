use anyhow::{anyhow, Context, Result};
use std::path::PathBuf;
use std::process::{ExitStatus, Stdio};
use tokio::process::{Child, Command};
use tracing::{info, warn};
use uuid::Uuid;

use super::{LaunchedUpdater, UpdaterParams};
use crate::config::update_config::BOOT_MARKER_WAIT_SECS;
use crate::platform::get_powershell_path;
use crate::platform::update_scripts::UPDATE_SCRIPT_WINDOWS;

/// Launch PowerShell updater script on Windows with the already-extracted binary
/// Uses CREATE_NO_WINDOW flag to run detached from console
pub async fn launch_updater(params: UpdaterParams) -> Result<LaunchedUpdater> {
    info!("Launching Windows PowerShell updater");

    // Save PowerShell script to temp file
    let script_path =
        std::env::temp_dir().join(format!("openframe-updater-{}.ps1", Uuid::new_v4()));

    // UTF-8 BOM: without it Windows PowerShell 5.1 reads the file as ANSI, and
    // any multi-byte character can decode into a smart quote that breaks parsing.
    tokio::fs::write(&script_path, format!("\u{FEFF}{}", UPDATE_SCRIPT_WINDOWS))
        .await
        .context("Failed to write PowerShell script")?;

    info!("PowerShell script saved to: {}", script_path.display());

    let ps_path = get_powershell_path().map_err(|e| anyhow!(e))?;
    info!("Using PowerShell: {}", ps_path);

    // Catches parse errors and anything printed before Start-Transcript; pruned with the transcripts.
    let output_path = params.transcript_path.with_extension("out.log");
    let stdout =
        std::fs::File::create(&output_path).context("Failed to create updater output file")?;
    let stderr = stdout
        .try_clone()
        .context("Failed to clone updater output handle")?;

    let mut command = Command::new(&ps_path);
    command.stdin(Stdio::null()).stdout(stdout).stderr(stderr);
    command
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-NoProfile")
        .arg("-NonInteractive")
        .arg("-File")
        .arg(&script_path)
        .arg("-NewExePath")
        .arg(&params.binary_path)
        .arg("-ServiceName")
        .arg(&params.service_name)
        .arg("-TargetExe")
        .arg(&params.target_exe)
        .arg("-UpdateStatePath")
        .arg(&params.update_state_path)
        .arg("-TargetVersion")
        .arg(&params.target_version)
        .arg("-BootMarkerPath")
        .arg(&params.boot_marker_path)
        .arg("-LkgPath")
        .arg(&params.lkg_path)
        .arg("-TranscriptPath")
        .arg(&params.transcript_path)
        .arg("-BootMarkerWaitSecs")
        .arg(BOOT_MARKER_WAIT_SECS.to_string())
        .creation_flags(0x08000000); // CREATE_NO_WINDOW
    if params.rollback_only {
        command.arg("-RollbackOnly");
    }
    let child = command
        .spawn()
        .context("Failed to spawn PowerShell updater")?;

    info!(
        "PowerShell updater launched (PID: {})",
        child.id().unwrap_or_default()
    );

    // No deadline: a cold PowerShell start can take longer than any fixed watch window.
    let exit_watch = tokio::spawn(watch_exit(child, output_path));

    Ok(LaunchedUpdater {
        exit_watch: Some(exit_watch),
    })
}

/// Resolves only if the updater exits while this process is still alive, i.e. before it stopped the service.
async fn watch_exit(mut child: Child, output_path: PathBuf) -> Option<ExitStatus> {
    let status = match child.wait().await {
        Ok(status) => status,
        Err(e) => {
            warn!("Lost track of the PowerShell updater process: {:#}", e);
            return None;
        }
    };
    let data = tokio::fs::read(&output_path).await.unwrap_or_default();
    let tail = String::from_utf8_lossy(&data[data.len().saturating_sub(2048)..]);
    warn!(
        "PowerShell updater exited with {} while this process is still alive; output: {}",
        status,
        tail.trim()
    );
    Some(status)
}
