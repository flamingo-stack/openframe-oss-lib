use anyhow::{anyhow, Result};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

use crate::config::updater_config::{
    ALLOW_DOWNGRADE, BACKUP_RESTORE_ATTEMPTS, BACKUP_RESTORE_RETRY_DELAY_SECS,
    BOOT_MARKER_POLL_INTERVAL_SECS, BOOT_MARKER_WAIT_SECS, CLIENT_SERVICE_FULL_NAME,
    MIN_BINARY_SIZE_BYTES, SERVICE_START_SETTLE_SECS, TOOL_OP_QUIESCE_WAIT_SECS,
};
use crate::models::{ClientUpdateMessage, UpdaterPhase, UpdaterState};
use crate::platform::atomic_replace;
use crate::services::boot_marker_service::BootMarkerService;
use crate::services::client_tool_op_probe::ClientToolOpProbe;
use crate::services::service_manager_service::ServiceManagerService;
use crate::services::{GithubDownloadService, UpdateProgressPublisher, UpdaterStateService};
use crate::utils::blocking::run_blocking;

#[derive(Clone)]
pub struct ClientUpdateService {
    download_service: GithubDownloadService,
    state_service: UpdaterStateService,
    progress_publisher: UpdateProgressPublisher,
    boot_marker: BootMarkerService,
    tool_op_probe: ClientToolOpProbe,
    /// The update slot: held as an owned guard for the whole of run_update, so
    /// it is released on every exit path, panics included.
    in_progress: Arc<Mutex<()>>,
}

impl ClientUpdateService {
    pub fn new(
        download_service: GithubDownloadService,
        state_service: UpdaterStateService,
        progress_publisher: UpdateProgressPublisher,
        boot_marker: BootMarkerService,
        tool_op_probe: ClientToolOpProbe,
    ) -> Self {
        Self {
            download_service,
            state_service,
            progress_publisher,
            boot_marker,
            tool_op_probe,
            in_progress: Arc::new(Mutex::new(())),
        }
    }

    pub async fn process_update(&self, msg: ClientUpdateMessage) -> Result<()> {
        let _slot = match self.in_progress.clone().try_lock_owned() {
            Ok(guard) => guard,
            Err(_) => {
                // An ACK would silently consume a genuinely new update.
                warn!(
                    "Update already in progress — leaving message for v{} unacked for redelivery",
                    msg.version
                );
                return Err(anyhow!(
                    "update already in progress, deferring v{} to redelivery",
                    msg.version
                ));
            }
        };

        self.run_update(&msg).await
    }

    async fn run_update(&self, msg: &ClientUpdateMessage) -> Result<()> {
        let requested_semver = match semver::Version::parse(msg.version.trim_start_matches('v')) {
            Ok(v) => v,
            Err(_) => {
                let reason = format!("Invalid version string: '{}'", msg.version);
                error!("{}", reason);
                self.progress_publisher
                    .publish_failure(&UpdaterPhase::Failed, &msg.version, &reason, false)
                    .await;
                // Ok → ACK: a malformed version never becomes valid on redelivery.
                return Ok(());
            }
        };
        let canonical_version = requested_semver.to_string();
        let version = &canonical_version;
        info!("Starting update to v{}", version);

        // The boot marker holds the version the client last booted with — the
        // updater's only view of the running client version.
        let booted = self.boot_marker.boot_marker_version();
        if booted
            .as_deref()
            .map(|m| Self::versions_match(m, version))
            .unwrap_or(false)
        {
            info!(
                "Client already booted with version {}, ignoring update request",
                version
            );
            return Ok(());
        }

        // A message redelivered after a newer update landed must not take the client back.
        if let (false, Some(booted)) = (ALLOW_DOWNGRADE, booted.as_deref()) {
            match semver::Version::parse(booted.trim_start_matches('v')) {
                Ok(booted_semver) if requested_semver < booted_semver => {
                    let reason = format!(
                        "Refusing downgrade to {} — client booted with {}",
                        version, booted
                    );
                    warn!("{}", reason);
                    self.progress_publisher
                        .publish_failure(&UpdaterPhase::Failed, version, &reason, false)
                        .await;
                    // Ok → ACK: redelivering a refused downgrade changes nothing.
                    return Ok(());
                }
                Ok(_) => {}
                Err(e) => warn!(
                    "Failed to parse booted version '{}', skipping downgrade guard: {:#}",
                    booted, e
                ),
            }
        }

        let mut state = UpdaterState::new(version.clone());

        let config = match self
            .download_service
            .find_for_current_os(&msg.download_configurations)
        {
            Ok(c) => c,
            Err(e) => {
                let reason = format!("No download config for current OS (v{}): {:#}", version, e);
                error!("{}", reason);
                self.fail(&mut state, version, &reason, false).await;
                // Ok → ACK: a message with no artifact for this OS never becomes valid.
                return Ok(());
            }
        };

        self.state_service
            .transition(&mut state, UpdaterPhase::Downloading)?;
        self.progress_publisher
            .publish(&UpdaterPhase::Downloading, version)
            .await;

        let binary_bytes = match self.download_service.download_and_extract(config).await {
            Ok(bytes) => bytes,
            Err(e) => {
                let reason = format!("Download failed: {:#}", e);
                error!("{}", reason);
                self.fail(&mut state, version, &reason, false).await;
                return Err(anyhow!(reason));
            }
        };

        self.state_service
            .transition(&mut state, UpdaterPhase::Verifying)?;
        self.progress_publisher
            .publish(&UpdaterPhase::Verifying, version)
            .await;

        if binary_bytes.len() < MIN_BINARY_SIZE_BYTES as usize {
            let reason = format!(
                "Binary too small ({} bytes, minimum {})",
                binary_bytes.len(),
                MIN_BINARY_SIZE_BYTES
            );
            error!("{}", reason);
            self.fail(&mut state, version, &reason, false).await;
            return Err(anyhow!(reason));
        }

        let target = ServiceManagerService::client_binary_path();
        let temp_path = {
            let target = target.clone();
            match run_blocking(move || atomic_replace::write_temp(&binary_bytes, &target)).await {
                Ok(p) => p,
                Err(e) => {
                    let reason = format!("Failed to write temp binary: {:#}", e);
                    error!("{}", reason);
                    self.fail(&mut state, version, &reason, false).await;
                    return Err(anyhow!(reason));
                }
            }
        };
        state.downloaded_binary_path = Some(temp_path.to_string_lossy().to_string());
        self.state_service.save(&state)?;

        // The client parks new tool operations while this state file shows an
        // in-flight phase; operations that started earlier must finish before the
        // client is stopped, or their tool record and directory are left half-done.
        if let Err(busy) = self.tool_op_probe.wait_for_quiescence().await {
            let reason = format!(
                "Client tool operations still in flight after {}s ({}) — deferring update to v{} to redelivery",
                TOOL_OP_QUIESCE_WAIT_SECS,
                busy.join(", "),
                version
            );
            warn!("{}", reason);
            self.cleanup_temp(&temp_path);
            if let Err(e) = self.state_service.clear() {
                warn!("Failed to clear updater state after deferral: {:#}", e);
            }
            return Err(anyhow!(reason));
        }

        self.state_service
            .transition(&mut state, UpdaterPhase::StoppingService)?;
        self.progress_publisher
            .publish(&UpdaterPhase::StoppingService, version)
            .await;

        if let Err(e) = ServiceManagerService::stop_async(CLIENT_SERVICE_FULL_NAME).await {
            let reason = format!("Failed to stop service: {:#}", e);
            error!("{}", reason);
            self.cleanup_temp(&temp_path);
            self.fail(&mut state, version, &reason, false).await;
            return Err(anyhow!(reason));
        }

        // Point of no return: from here a state-persistence failure must not abort
        // the swap — the file only drives crash recovery, while aborting strands a
        // stopped client. The backup path is persisted before the binary is
        // touched, so recovery knows where the previous binary went even if the
        // swap never returns.
        let backup_path = atomic_replace::backup_path_for(&target);
        state.backup_path = Some(backup_path.to_string_lossy().to_string());
        self.transition_best_effort(&mut state, UpdaterPhase::ReplacingBinary);
        self.progress_publisher
            .publish(&UpdaterPhase::ReplacingBinary, version)
            .await;

        let replaced = {
            let (target, temp_path, backup_path) =
                (target.clone(), temp_path.clone(), backup_path.clone());
            run_blocking(move || atomic_replace::replace(&target, &temp_path, &backup_path)).await
        };
        if let Err(e) = replaced {
            let reason = format!("Binary replacement failed: {:#}", e);
            error!("{}", reason);
            if target.exists() {
                self.try_start_service(version, false).await;
                self.fail(&mut state, version, &reason, true).await;
            } else {
                // Half-swapped: keep the state file (it holds the backup path
                // crash recovery needs) and leave the message unacked.
                self.progress_publisher
                    .publish_failure(&UpdaterPhase::Failed, version, &reason, false)
                    .await;
            }
            return Err(anyhow!(reason));
        }

        // Stale markers must go before the new binary starts: the verification
        // below treats any marker that doesn't match the target as a failure.
        if let Err(e) = self.boot_marker.clear_boot_marker() {
            let reason = format!("Failed to clear boot marker before start: {:#}", e);
            error!("{}", reason);
            return self
                .restore_backup(&mut state, &target, &backup_path, version, &reason)
                .await;
        }

        self.transition_best_effort(&mut state, UpdaterPhase::StartingService);
        self.progress_publisher
            .publish(&UpdaterPhase::StartingService, version)
            .await;

        if let Err(e) = ServiceManagerService::start_async(CLIENT_SERVICE_FULL_NAME).await {
            let reason = format!("Failed to start new service: {:#}", e);
            error!("{}", reason);
            return self
                .restore_backup(&mut state, &target, &backup_path, version, &reason)
                .await;
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(SERVICE_START_SETTLE_SECS)).await;

        match ServiceManagerService::is_running_async(CLIENT_SERVICE_FULL_NAME).await {
            Ok(true) => {}
            Ok(false) => {
                let reason = "Service is not running after start".to_string();
                error!("{}", reason);
                return self
                    .restore_backup(&mut state, &target, &backup_path, version, &reason)
                    .await;
            }
            Err(e) => {
                let reason = format!("Failed to check service state: {:#}", e);
                error!("{}", reason);
                return self
                    .restore_backup(&mut state, &target, &backup_path, version, &reason)
                    .await;
            }
        }

        self.transition_best_effort(&mut state, UpdaterPhase::VerifyingBoot);
        self.progress_publisher
            .publish(&UpdaterPhase::VerifyingBoot, version)
            .await;

        if let Err(reason) = self.wait_for_boot_marker(version).await {
            error!("{}", reason);
            return self
                .restore_backup(&mut state, &target, &backup_path, version, &reason)
                .await;
        }

        // Boot verified: the swap is final. The NATS message ACKs when this returns.
        Self::remove_backup(&backup_path);
        if let Err(e) = self.state_service.clear() {
            warn!("Failed to clear updater state after update: {:#}", e);
        }
        self.progress_publisher.publish_success(version).await;

        info!("Update to v{} completed", version);
        Ok(())
    }

    /// Wait for the new client binary to write a boot marker with the target
    /// version. A marker carrying a different version means the wrong binary
    /// booted — fail immediately instead of waiting out the window.
    async fn wait_for_boot_marker(&self, version: &str) -> std::result::Result<(), String> {
        info!(
            "Waiting up to {}s for boot marker with version {}",
            BOOT_MARKER_WAIT_SECS, version
        );

        let mut elapsed = 0u64;
        while elapsed < BOOT_MARKER_WAIT_SECS {
            match self.boot_marker.boot_marker_version() {
                Some(marker) if Self::versions_match(&marker, version) => {
                    info!("Boot marker matched target version {}", version);
                    return Ok(());
                }
                Some(marker) => {
                    return Err(format!(
                        "Boot marker reports '{}', expected '{}' — wrong binary booted",
                        marker, version
                    ));
                }
                None => {}
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(
                BOOT_MARKER_POLL_INTERVAL_SECS,
            ))
            .await;
            elapsed += BOOT_MARKER_POLL_INTERVAL_SECS;
        }

        Err(format!(
            "New binary did not report target version '{}' within {}s",
            version, BOOT_MARKER_WAIT_SECS
        ))
    }

    /// The new binary failed to start or to verify its boot: put the pre-swap
    /// binary back and start it. The update is reported failed either way.
    async fn restore_backup(
        &self,
        state: &mut UpdaterState,
        target: &Path,
        backup_path: &Path,
        version: &str,
        reason: &str,
    ) -> Result<()> {
        warn!(
            "Restoring the pre-swap client binary after a failed update to v{}: {}",
            version, reason
        );

        // The service may still be running the bad binary (e.g. it booted but
        // reported the wrong version) — stop it before touching the file.
        self.stop_service_if_running("before restoring the backup")
            .await;

        if !self.restore_with_retry(target, backup_path).await {
            let full_reason = format!("{} — restoring the previous binary also failed", reason);
            error!("{}", full_reason);
            self.fail(state, version, &full_reason, false).await;
            return Err(anyhow!(full_reason));
        }

        // The failed binary may have left a marker with the target version; crash
        // recovery must not read it as the update having booted.
        if let Err(e) = self.boot_marker.clear_boot_marker() {
            warn!(
                "Failed to clear boot marker before restarting the previous binary: {:#}",
                e
            );
        }
        self.try_start_service(version, true).await;

        self.fail(state, version, reason, true).await;
        Err(anyhow!(
            "Update failed, previous binary restored: {}",
            reason
        ))
    }

    async fn restore_with_retry(&self, target: &Path, backup_path: &Path) -> bool {
        if !backup_path.exists() {
            error!("No pre-swap backup to restore at {}", backup_path.display());
            return false;
        }
        for attempt in 1..=BACKUP_RESTORE_ATTEMPTS {
            let (backup, target) = (backup_path.to_path_buf(), target.to_path_buf());
            match run_blocking(move || atomic_replace::restore(&backup, &target)).await {
                Ok(()) => {
                    info!("Restored client binary from {}", backup_path.display());
                    return true;
                }
                Err(e) => {
                    warn!(
                        "Restore attempt {}/{} from {} failed: {:#}",
                        attempt,
                        BACKUP_RESTORE_ATTEMPTS,
                        backup_path.display(),
                        e
                    );
                    tokio::time::sleep(tokio::time::Duration::from_secs(
                        BACKUP_RESTORE_RETRY_DELAY_SECS,
                    ))
                    .await;
                }
            }
        }
        false
    }

    async fn stop_service_if_running(&self, ctx: &str) {
        if let Ok(true) = ServiceManagerService::is_running_async(CLIENT_SERVICE_FULL_NAME).await {
            if let Err(e) = ServiceManagerService::stop_async(CLIENT_SERVICE_FULL_NAME).await {
                warn!("Failed to stop service {}: {:#}", ctx, e);
            }
        }
    }

    async fn try_start_service(&self, version: &str, after_restore: bool) {
        if let Err(e) = ServiceManagerService::start_async(CLIENT_SERVICE_FULL_NAME).await {
            let ctx = if after_restore {
                "after restoring the previous binary"
            } else {
                "after failed replace"
            };
            error!("Failed to restart service {}: {:#}", ctx, e);
            self.progress_publisher
                .publish_failure(
                    &UpdaterPhase::Failed,
                    version,
                    &format!("Service restart failed {}: {:#}", ctx, e),
                    after_restore,
                )
                .await;
        }
    }

    /// Boot-marker versions come from the client's build env, requested versions
    /// from the backend — compare semver-first so cosmetic differences (leading
    /// 'v', metadata formatting) never read as a wrong-binary boot.
    fn versions_match(marker: &str, requested: &str) -> bool {
        match (
            semver::Version::parse(marker.trim_start_matches('v')),
            semver::Version::parse(requested.trim_start_matches('v')),
        ) {
            (Ok(m), Ok(r)) => m == r,
            _ => marker == requested,
        }
    }

    /// Past the point of no return a state-persistence failure must not abort
    /// the swap: the file only drives crash recovery, while aborting strands a
    /// stopped client. Log and continue.
    fn transition_best_effort(&self, state: &mut UpdaterState, phase: UpdaterPhase) {
        let label = phase.to_string();
        if let Err(e) = self.state_service.transition(state, phase) {
            warn!("Failed to persist {} state (continuing): {:#}", label, e);
        }
    }

    async fn fail(&self, state: &mut UpdaterState, version: &str, reason: &str, rolled_back: bool) {
        state.failure_reason = Some(reason.to_string());
        if let Err(e) = self.state_service.transition(state, UpdaterPhase::Failed) {
            warn!("Failed to persist Failed state: {}", e);
        }
        self.progress_publisher
            .publish_failure(&UpdaterPhase::Failed, version, reason, rolled_back)
            .await;
        let _ = self.state_service.clear();
    }

    fn remove_backup(backup_path: &Path) {
        if backup_path.exists() {
            if let Err(e) = std::fs::remove_file(backup_path) {
                warn!(
                    "Failed to remove backup file {}: {}",
                    backup_path.display(),
                    e
                );
            }
        }
    }

    fn cleanup_temp(&self, temp_path: &PathBuf) {
        if temp_path.exists() {
            if let Err(e) = std::fs::remove_file(temp_path) {
                warn!(
                    "Failed to clean up temp file {}: {}",
                    temp_path.display(),
                    e
                );
            }
        }
    }
}

#[cfg(test)]
#[path = "client_update_service_tests.rs"]
mod tests;
