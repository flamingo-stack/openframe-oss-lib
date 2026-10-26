use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::{Mutex, OwnedMutexGuard};
use tokio::time::Duration;
use tracing::{error, info, warn};

use crate::config::updater_config::{
    ALLOW_DOWNGRADE, BOOT_MARKER_POLL_INTERVAL_SECS, BOOT_MARKER_WAIT_SECS,
    CLIENT_SERVICE_FULL_NAME, DRAIN_WAIT_SECS, MIN_BINARY_SIZE_BYTES, SERVICE_START_SETTLE_SECS,
};
use crate::models::{ClientUpdateMessage, UpdaterPhase, UpdaterState};
use crate::platform::atomic_replace;
use crate::services::boot_marker_service::BootMarkerService;
use crate::services::client_binary::{self, Restore};
use crate::services::client_drain::ClientDrain;
use crate::services::service_manager_service::ServiceManagerService;
use crate::services::{GithubDownloadService, UpdateProgressPublisher, UpdaterStateService};
use crate::utils::blocking::run_blocking;

/// How an update request ended, for the listener to acknowledge.
#[derive(Debug, PartialEq)]
pub enum UpdateOutcome {
    /// The client runs the requested version: updated now, or already on it.
    Applied,
    /// Refused before anything changed; the same request can never succeed.
    Rejected(String),
    /// Did not land and the previous client is in place, so a retry may succeed.
    Failed(String),
}

/// Held for the whole of one update, released on every exit path, panics included.
pub type UpdateSlot = OwnedMutexGuard<()>;

#[derive(Clone)]
pub struct ClientUpdateService {
    download_service: GithubDownloadService,
    state_service: UpdaterStateService,
    progress_publisher: UpdateProgressPublisher,
    boot_marker: BootMarkerService,
    client_drain: ClientDrain,
    in_progress: Arc<Mutex<()>>,
}

impl ClientUpdateService {
    pub fn new(
        download_service: GithubDownloadService,
        state_service: UpdaterStateService,
        progress_publisher: UpdateProgressPublisher,
        boot_marker: BootMarkerService,
        client_drain: ClientDrain,
    ) -> Self {
        Self {
            download_service,
            state_service,
            progress_publisher,
            boot_marker,
            client_drain,
            in_progress: Arc::new(Mutex::new(())),
        }
    }

    /// False while the running client still updates itself (it predates the
    /// updater, or a downgrade brought such a client back): requests are its own.
    pub fn client_delegates_updates(&self) -> bool {
        self.boot_marker.client_delegates_updates()
    }

    /// The update slot, or `None` while another update runs.
    pub fn try_reserve(&self) -> Option<UpdateSlot> {
        self.in_progress.clone().try_lock_owned().ok()
    }

    pub async fn apply(&self, msg: &ClientUpdateMessage, _slot: UpdateSlot) -> UpdateOutcome {
        let version = match self.check_request(msg).await {
            Ok(Some(version)) => version,
            Ok(None) => return UpdateOutcome::Applied,
            Err(reason) => return UpdateOutcome::Rejected(reason),
        };
        info!("Starting update to v{}", version);
        let mut state = UpdaterState::new(version);

        let temp_path = match self.acquire_binary(msg, &mut state).await {
            Ok(path) => path,
            Err(outcome) => return outcome,
        };
        if let Err(outcome) = self.stop_client_for_swap(&mut state, &temp_path).await {
            return outcome;
        }
        self.swap_and_verify(&mut state, &temp_path).await
    }

    /// The version to install; `None` when the client already runs it, `Err`
    /// with the reason when the request is refused.
    async fn check_request(&self, msg: &ClientUpdateMessage) -> Result<Option<String>, String> {
        let requested = match semver::Version::parse(msg.version.trim_start_matches('v')) {
            Ok(v) => v,
            Err(_) => {
                let reason = format!("Invalid version string: '{}'", msg.version);
                return Err(self.refuse(&msg.version, reason).await);
            }
        };
        let version = requested.to_string();

        // The boot marker holds the version the client last booted with — the
        // updater's only view of the running client version.
        let booted = self.boot_marker.boot_marker_version();
        if booted
            .as_deref()
            .map(|m| Self::versions_match(m, &version))
            .unwrap_or(false)
        {
            info!(
                "Client already booted with version {}, ignoring update request",
                version
            );
            return Ok(None);
        }

        // A message redelivered after a newer update landed must not take the client back.
        if let (false, Some(booted)) = (ALLOW_DOWNGRADE, booted.as_deref()) {
            match semver::Version::parse(booted.trim_start_matches('v')) {
                Ok(booted_semver) if requested < booted_semver => {
                    let reason = format!(
                        "Refusing downgrade to {} — client booted with {}",
                        version, booted
                    );
                    return Err(self.refuse(&version, reason).await);
                }
                Ok(_) => {}
                Err(e) => warn!(
                    "Failed to parse booted version '{}', skipping downgrade guard: {:#}",
                    booted, e
                ),
            }
        }

        Ok(Some(version))
    }

    async fn refuse(&self, version: &str, reason: String) -> String {
        warn!("{}", reason);
        self.progress_publisher
            .publish_failure(&UpdaterPhase::Failed, version, &reason, false)
            .await;
        reason
    }

    /// Downloads the new binary and stages it next to the client's; nothing the
    /// running client uses is touched yet.
    async fn acquire_binary(
        &self,
        msg: &ClientUpdateMessage,
        state: &mut UpdaterState,
    ) -> Result<PathBuf, UpdateOutcome> {
        let config = match self
            .download_service
            .find_for_current_os(&msg.download_configurations)
        {
            Ok(c) => c,
            Err(e) => {
                let reason = format!(
                    "No download config for current OS (v{}): {:#}",
                    state.target_version, e
                );
                error!("{}", reason);
                self.fail(state, &reason, false).await;
                return Err(UpdateOutcome::Rejected(reason));
            }
        };

        self.enter(state, UpdaterPhase::Downloading).await?;
        let binary_bytes = match self.download_service.download_and_extract(config).await {
            Ok(bytes) => bytes,
            Err(e) => {
                return Err(self
                    .failed(state, format!("Download failed: {:#}", e))
                    .await)
            }
        };

        self.enter(state, UpdaterPhase::Verifying).await?;
        if binary_bytes.len() < MIN_BINARY_SIZE_BYTES as usize {
            let reason = format!(
                "Binary too small ({} bytes, minimum {})",
                binary_bytes.len(),
                MIN_BINARY_SIZE_BYTES
            );
            return Err(self.failed(state, reason).await);
        }

        let target = ServiceManagerService::client_binary_path();
        let temp_path =
            match run_blocking(move || atomic_replace::write_temp(&binary_bytes, &target)).await {
                Ok(path) => path,
                Err(e) => {
                    let reason = format!("Failed to write temp binary: {:#}", e);
                    return Err(self.failed(state, reason).await);
                }
            };
        state.downloaded_binary_path = Some(temp_path.clone());
        if let Err(e) = self.state_service.save(state) {
            client_binary::remove_quietly(&temp_path, "temp binary");
            let reason = format!("Failed to persist updater state: {:#}", e);
            return Err(self.failed(state, reason).await);
        }
        Ok(temp_path)
    }

    /// Lets the client finish its running work, then stops it. On failure the
    /// staged binary goes and the client keeps running.
    async fn stop_client_for_swap(
        &self,
        state: &mut UpdaterState,
        temp_path: &Path,
    ) -> Result<(), UpdateOutcome> {
        // Only this update's confirmation may release the wait, never one an
        // earlier update left behind.
        self.client_drain.clear();
        if let Err(outcome) = self.enter(state, UpdaterPhase::Draining).await {
            client_binary::remove_quietly(temp_path, "temp binary");
            return Err(outcome);
        }
        if ServiceManagerService::query_running(CLIENT_SERVICE_FULL_NAME).await == Some(false) {
            info!("Client is not running, nothing to drain");
        } else if !self.client_drain.wait(&state.started_at).await {
            warn!(
                "Client did not confirm the drain within {}s, stopping it anyway",
                DRAIN_WAIT_SECS
            );
        }

        if let Err(outcome) = self.enter(state, UpdaterPhase::StoppingService).await {
            client_binary::remove_quietly(temp_path, "temp binary");
            return Err(outcome);
        }
        if let Err(e) = ServiceManagerService::stop_async(CLIENT_SERVICE_FULL_NAME).await {
            client_binary::remove_quietly(temp_path, "temp binary");
            return Err(self
                .failed(state, format!("Failed to stop service: {:#}", e))
                .await);
        }
        Ok(())
    }

    /// Swaps the binary and proves the new one booted; any failure after the
    /// swap puts the previous binary back.
    async fn swap_and_verify(&self, state: &mut UpdaterState, temp_path: &Path) -> UpdateOutcome {
        let version = state.target_version.clone();
        let target = ServiceManagerService::client_binary_path();

        // Point of no return: from here a state-persistence failure must not abort
        // the swap — the file only drives crash recovery, while aborting strands a
        // stopped client. The backup path is persisted before the binary is
        // touched, so recovery knows where the previous binary went even if the
        // swap never returns.
        let backup_path = atomic_replace::backup_path_for(&target);
        state.backup_path = Some(backup_path.clone());
        self.enter_best_effort(state, UpdaterPhase::ReplacingBinary)
            .await;

        let replaced = {
            let (target, temp_path, backup_path) =
                (target.clone(), temp_path.to_path_buf(), backup_path.clone());
            run_blocking(move || atomic_replace::replace(&target, &temp_path, &backup_path)).await
        };
        if let Err(e) = replaced {
            client_binary::remove_quietly(temp_path, "temp binary");
            let reason = format!("Binary replacement failed: {:#}", e);
            if target.exists() {
                // replace() already put the previous binary back when activation failed.
                error!("{}", reason);
                self.try_start_service(&version, false).await;
                self.fail(state, &reason, true).await;
                return UpdateOutcome::Failed(reason);
            }
            return self
                .restore_previous(state, &target, &backup_path, reason)
                .await;
        }

        // Stale markers must go before the new binary starts: the verification
        // below treats any marker that doesn't match the target as a failure.
        if let Err(e) = self.boot_marker.clear_boot_marker() {
            let reason = format!("Failed to clear boot marker before start: {:#}", e);
            return self
                .restore_previous(state, &target, &backup_path, reason)
                .await;
        }

        self.enter_best_effort(state, UpdaterPhase::StartingService)
            .await;
        if let Err(e) = ServiceManagerService::start_async(CLIENT_SERVICE_FULL_NAME).await {
            let reason = format!("Failed to start new service: {:#}", e);
            return self
                .restore_previous(state, &target, &backup_path, reason)
                .await;
        }
        tokio::time::sleep(Duration::from_secs(SERVICE_START_SETTLE_SECS)).await;

        // Only a confirmed stop counts against the new binary; an unknown state is
        // left to the boot marker below.
        match ServiceManagerService::query_running(CLIENT_SERVICE_FULL_NAME).await {
            Some(true) => {}
            Some(false) => {
                let reason = "Service is not running after start".to_string();
                return self
                    .restore_previous(state, &target, &backup_path, reason)
                    .await;
            }
            None => warn!("Client service state unknown after start, relying on the boot marker"),
        }

        self.enter_best_effort(state, UpdaterPhase::VerifyingBoot)
            .await;
        if let Err(reason) = self.wait_for_boot_marker(&version).await {
            return self
                .restore_previous(state, &target, &backup_path, reason)
                .await;
        }

        // Boot verified: the swap is final.
        client_binary::remove_quietly(&backup_path, "backup");
        if let Err(e) = self.state_service.clear() {
            warn!("Failed to clear updater state after update: {:#}", e);
        }
        self.progress_publisher.publish_success(&version).await;

        info!("Update to v{} completed", version);
        UpdateOutcome::Applied
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
            tokio::time::sleep(Duration::from_secs(BOOT_MARKER_POLL_INTERVAL_SECS)).await;
            elapsed += BOOT_MARKER_POLL_INTERVAL_SECS;
        }

        Err(format!(
            "New binary did not report target version '{}' within {}s",
            version, BOOT_MARKER_WAIT_SECS
        ))
    }

    /// The new binary failed to start or to verify its boot: put the pre-swap
    /// binary back and start it. The update is reported failed either way.
    async fn restore_previous(
        &self,
        state: &mut UpdaterState,
        target: &Path,
        backup_path: &Path,
        reason: String,
    ) -> UpdateOutcome {
        error!("{}", reason);
        warn!(
            "Restoring the pre-swap client binary after a failed update to v{}",
            state.target_version
        );

        match client_binary::restore_previous_binary(backup_path, target, &self.boot_marker).await {
            Restore::Restored => {
                self.fail(state, &reason, true).await;
                UpdateOutcome::Failed(format!("{}; previous binary restored", reason))
            }
            Restore::RestoredNotStarted(start_error) => {
                let reason = format!(
                    "{}; previous binary restored but its service did not start: {}",
                    reason, start_error
                );
                self.fail(state, &reason, true).await;
                UpdateOutcome::Failed(reason)
            }
            Restore::Failed => {
                let reason = format!("{} — restoring the previous binary also failed", reason);
                error!("{}", reason);
                if target.exists() {
                    // Whatever binary is in place beats a stopped client.
                    self.try_start_service(&state.target_version, false).await;
                    self.fail(state, &reason, false).await;
                } else {
                    // No client binary at all: keep the state file, its backup path
                    // is what crash recovery retries with.
                    self.progress_publisher
                        .publish_failure(
                            &UpdaterPhase::Failed,
                            &state.target_version,
                            &reason,
                            false,
                        )
                        .await;
                }
                UpdateOutcome::Failed(reason)
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

    /// Persists and reports the next phase. Before the swap a state that can't be
    /// saved stops the update.
    async fn enter(
        &self,
        state: &mut UpdaterState,
        phase: UpdaterPhase,
    ) -> Result<(), UpdateOutcome> {
        if let Err(e) = self.state_service.transition(state, phase.clone()) {
            let reason = format!("Failed to persist {} state: {:#}", phase, e);
            return Err(self.failed(state, reason).await);
        }
        self.progress_publisher
            .publish(&phase, &state.target_version)
            .await;
        Ok(())
    }

    /// Past the point of no return a state-persistence failure must not abort
    /// the swap: the file only drives crash recovery, while aborting strands a
    /// stopped client. Log and continue.
    async fn enter_best_effort(&self, state: &mut UpdaterState, phase: UpdaterPhase) {
        if let Err(e) = self.state_service.transition(state, phase.clone()) {
            warn!("Failed to persist {} state (continuing): {:#}", phase, e);
        }
        self.progress_publisher
            .publish(&phase, &state.target_version)
            .await;
    }

    async fn failed(&self, state: &mut UpdaterState, reason: String) -> UpdateOutcome {
        error!("{}", reason);
        self.fail(state, &reason, false).await;
        UpdateOutcome::Failed(reason)
    }

    async fn fail(&self, state: &mut UpdaterState, reason: &str, rolled_back: bool) {
        state.failure_reason = Some(reason.to_string());
        if let Err(e) = self.state_service.transition(state, UpdaterPhase::Failed) {
            warn!("Failed to persist Failed state: {}", e);
        }
        self.progress_publisher
            .publish_failure(
                &UpdaterPhase::Failed,
                &state.target_version,
                reason,
                rolled_back,
            )
            .await;
        let _ = self.state_service.clear();
    }
}

#[cfg(test)]
#[path = "client_update_service_tests.rs"]
mod tests;
