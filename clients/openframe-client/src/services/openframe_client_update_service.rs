use crate::config::update_config::ALLOW_DOWNGRADE;
use crate::models::openframe_client_info::ClientUpdateStatus;
use crate::models::openframe_client_update_message::OpenFrameClientUpdateMessage;
use crate::models::update_state::{UpdatePhase, UpdateState};
use crate::platform::updater_launcher::{self, LaunchedUpdater, UpdaterParams};
use crate::service::FULL_SERVICE_NAME;
use crate::services::github_download_service::GithubDownloadService;
use crate::services::last_known_good_service::LastKnownGoodService;
use crate::services::openframe_client_info_service::OpenFrameClientInfoService;
use crate::services::tool_run_manager::ToolRunManager;
use crate::services::update_handler_service::UpdateHandlerService;
use crate::services::update_state_service::UpdateStateService;
use anyhow::{anyhow, Context, Result};
use semver::Version;
use std::path::{Path, PathBuf};
use std::process::ExitStatus;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Marks an update as in progress until dropped
struct UpdateGuard(Arc<AtomicBool>);

impl UpdateGuard {
    fn acquire(flag: &Arc<AtomicBool>) -> Option<Self> {
        flag.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
            .then(|| Self(flag.clone()))
    }
}

impl Drop for UpdateGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
        info!("Released update lock");
    }
}

#[derive(Clone)]
pub struct OpenFrameClientUpdateService {
    client_info_service: OpenFrameClientInfoService,
    github_download_service: GithubDownloadService,
    update_state_service: UpdateStateService,
    last_known_good_service: LastKnownGoodService,
    tool_run_manager: ToolRunManager,
    update_handler_service: UpdateHandlerService,
    /// Set from the update request until the updater is done with this process
    update_in_progress: Arc<AtomicBool>,
}

impl OpenFrameClientUpdateService {
    pub fn new(
        client_info_service: OpenFrameClientInfoService,
        github_download_service: GithubDownloadService,
        update_state_service: UpdateStateService,
        last_known_good_service: LastKnownGoodService,
        tool_run_manager: ToolRunManager,
        update_handler_service: UpdateHandlerService,
    ) -> Self {
        Self {
            client_info_service,
            github_download_service,
            update_state_service,
            last_known_good_service,
            tool_run_manager,
            update_handler_service,
            update_in_progress: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn process_update(&self, message: OpenFrameClientUpdateMessage) -> Result<()> {
        let requested_version = message.version.trim();
        info!("Received update request for version: {}", requested_version);

        self.tool_run_manager.mark_client_update_pending().await;

        if self.tool_run_manager.any_tool_op_in_progress().await {
            warn!("Tool operation in progress, deferring client update to version {} (will redeliver)", requested_version);
            return Err(anyhow!(
                "Tool operation in progress, deferring client update"
            ));
        }

        // 1. Held until the updater is done with this process, so a redelivery cannot overlap a live script
        let Some(guard) = UpdateGuard::acquire(&self.update_in_progress) else {
            warn!(
                "Update already in progress, ignoring duplicate request for version: {}",
                requested_version
            );
            return Err(anyhow!("Update already in progress"));
        };
        info!("Acquired update lock for version: {}", requested_version);

        self.process_update_internal(message, guard).await
    }

    /// Internal update processing with version validation and safety checks
    async fn process_update_internal(
        &self,
        message: OpenFrameClientUpdateMessage,
        guard: UpdateGuard,
    ) -> Result<()> {
        let requested_version = message.version.trim();

        // 2. Validate version format
        if !Self::is_valid_version(requested_version) {
            error!("Invalid version format: {}", requested_version);
            return Err(anyhow!("Invalid version format: {}", requested_version));
        }

        let requested_semver = Self::parse_version(requested_version)
            .with_context(|| format!("Failed to parse requested version: {}", requested_version))?;
        let canonical_version = requested_semver.to_string();

        if canonical_version == env!("OPENFRAME_VERSION") {
            info!(
                "Already running version {}, ignoring update request",
                canonical_version
            );
            self.tool_run_manager.clear_client_update_pending().await;
            return Ok(());
        }

        if !ALLOW_DOWNGRADE {
            let anchor = match self.last_known_good_service.load().await {
                Ok(anchor) => anchor,
                Err(e) => {
                    warn!(
                        "Failed to load last-known-good anchor, skipping downgrade guard: {:#}",
                        e
                    );
                    None
                }
            };
            if let Some(anchor) = anchor {
                match Self::parse_version(&anchor) {
                    Ok(anchor_semver) if requested_semver < anchor_semver => {
                        warn!(
                            "refusing downgrade to {} — anchored at {}",
                            requested_version, anchor
                        );
                        self.tool_run_manager.clear_client_update_pending().await;
                        return Ok(());
                    }
                    Ok(_) => {}
                    Err(e) => warn!(
                        "Failed to parse last-known-good anchor '{}': {:#}",
                        anchor, e
                    ),
                }
            }
        }

        // 4. Log current version for informational purposes
        let client_info = self
            .client_info_service
            .get()
            .await
            .context("Failed to get current client info")?;

        if !client_info.current_version.is_empty() {
            info!(
                "Updating from version {} to {}",
                client_info.current_version, requested_version
            );
        } else {
            info!(
                "No current version set, installing version: {}",
                requested_version
            );
        }

        // 5. Create update state for tracking
        let mut update_state = UpdateState::new(canonical_version.clone());
        self.update_state_service
            .save(&update_state)
            .await
            .context("Failed to save initial update state")?;

        // 6. Set update status to updating
        self.client_info_service
            .set_update_status(
                ClientUpdateStatus::Updating,
                Some(canonical_version.clone()),
            )
            .await
            .context("Failed to set update status")?;

        info!("Starting update to version {}", requested_version);

        // Execute update with status rollback
        let update_result = self
            .execute_update(&message, &mut update_state, guard)
            .await;

        // Handle errors: set status to Failed (cleanup already done in execute_update)
        if let Err(ref e) = update_result {
            error!("Update failed: {:#}", e);

            // Set status to Failed
            if let Err(status_err) = self
                .client_info_service
                .set_update_status(ClientUpdateStatus::Failed, Some(canonical_version.clone()))
                .await
            {
                error!("Failed to set update status to Failed: {:#}", status_err);
            }

            info!("Update failed, NATS will retry");
        }

        update_result
    }

    /// Execute the actual update process
    async fn execute_update(
        &self,
        message: &OpenFrameClientUpdateMessage,
        update_state: &mut UpdateState,
        guard: UpdateGuard,
    ) -> Result<()> {
        // 1. Find the appropriate download configuration for current OS
        let download_config = self
            .github_download_service
            .find_config_for_current_os(&message.download_configurations)
            .context("Failed to find download configuration for current OS")?;

        info!(
            "Using download configuration for OS: {}",
            download_config.os
        );

        // 2. Download and extract binary using GithubDownloadService
        update_state.set_phase(UpdatePhase::Downloading);
        self.update_state_service.save(update_state).await?;

        let binary_bytes = match self
            .github_download_service
            .download_and_extract(download_config)
            .await
        {
            Ok(bytes) => bytes,
            Err(e) => {
                error!("Download failed: {:#}", e);
                // Clear update state - download failed, nothing to cleanup
                self.update_state_service.clear().await?;
                return Err(e.context("Failed to download and extract update"));
            }
        };

        info!(
            "Binary downloaded and extracted ({} bytes)",
            binary_bytes.len()
        );

        self.tool_run_manager.mark_client_update_pending().await;

        // 3. Extract binary
        update_state.set_phase(UpdatePhase::Extracting);
        self.update_state_service.save(update_state).await?;

        // 4. Stage the extracted binary for the updater script
        update_state.set_phase(UpdatePhase::PreparingUpdater);
        self.update_state_service.save(update_state).await?;

        let staged_path = match self
            .stage_binary(&binary_bytes, &download_config.target_file_name)
            .await
        {
            Ok(path) => path,
            Err(e) => {
                error!("Failed to stage binary: {:#}", e);
                self.update_state_service.clear().await?;
                return Err(e.context("Failed to stage update binary"));
            }
        };

        info!("Update binary staged: {}", staged_path.display());

        // 5. Launch update process (platform-specific)
        update_state.set_phase(UpdatePhase::UpdaterLaunched);
        self.update_state_service.save(update_state).await?;

        let current_exe =
            std::env::current_exe().context("Failed to get current executable path")?;

        let params = UpdaterParams {
            binary_path: staged_path.clone(),
            target_exe: current_exe,
            service_name: FULL_SERVICE_NAME.to_string(),
            update_state_path: self.update_state_service.get_state_file_path(),
            target_version: update_state.target_version.clone(),
            boot_marker_path: self
                .last_known_good_service
                .boot_marker_path()
                .to_path_buf(),
            lkg_path: self.last_known_good_service.reserve_path().to_path_buf(),
            transcript_path: self
                .last_known_good_service
                .new_transcript_path(&update_state.target_version),
            rollback_only: false,
        };

        if self.tool_run_manager.any_tool_op_in_progress().await {
            warn!("Tool operation started during client download, deferring client update (will redeliver)");
            if let Err(cleanup_err) = std::fs::remove_file(&staged_path) {
                warn!(
                    "Failed to remove staged binary after deferring: {}",
                    cleanup_err
                );
            }
            self.update_state_service.clear().await?;
            return Err(anyhow!(
                "Tool operation started during download, deferring client update"
            ));
        }

        // If launch failed, cleanup staged binary and state
        let launched = match updater_launcher::launch_updater(params).await {
            Ok(launched) => launched,
            Err(e) => {
                error!("Failed to launch updater: {:#}", e);
                if let Err(cleanup_err) = std::fs::remove_file(&staged_path) {
                    warn!(
                        "Failed to remove staged binary after launch failure: {}",
                        cleanup_err
                    );
                }
                self.update_state_service.clear().await?;
                return Err(e);
            }
        };

        // Stop all tool run loops to prevent launching processes during shutdown.
        self.tool_run_manager.signal_shutdown();
        self.watch_updater_exit(
            launched,
            guard,
            staged_path,
            update_state.target_version.clone(),
        );

        info!("Update process launched, service will be stopped by update script");
        Ok(())
    }

    /// The script's first real action stops this service, so an exit seen while we are alive means it failed before the swap.
    fn watch_updater_exit(
        &self,
        launched: LaunchedUpdater,
        guard: UpdateGuard,
        staged_path: PathBuf,
        target_version: String,
    ) {
        let Some(exit_watch) = launched.exit_watch else {
            return;
        };
        let this = self.clone();
        tokio::spawn(async move {
            let _guard = guard;
            if let Ok(Some(status)) = exit_watch.await {
                this.handle_updater_early_exit(status, &staged_path, &target_version)
                    .await;
            }
        });
    }

    /// Finishes the failure here instead of waiting for a boot that never comes: report it, clear the state, resume the tools.
    async fn handle_updater_early_exit(
        &self,
        status: ExitStatus,
        staged_path: &Path,
        target_version: &str,
    ) {
        if status.success() {
            warn!(
                "Updater for {} reported success while this process is still running, leaving the update state to the next boot",
                target_version
            );
            return;
        }

        if let Err(e) = tokio::fs::remove_file(staged_path).await {
            if e.kind() != std::io::ErrorKind::NotFound {
                warn!(
                    "Failed to remove staged binary {}: {}",
                    staged_path.display(),
                    e
                );
            }
        }

        let mut state = match self.update_state_service.load().await {
            Ok(Some(state)) => state,
            Ok(None) => {
                warn!(
                    "Updater for {} exited early and the update state is gone (client uninstalled?), nothing to finish",
                    target_version
                );
                return;
            }
            Err(e) => {
                warn!(
                    "Updater for {} exited early and the update state is unreadable: {:#}",
                    target_version, e
                );
                UpdateState::new(target_version.to_string())
            }
        };

        // Died before stamping a phase (parse error, killed): record what the launcher saw
        if !matches!(state.phase, UpdatePhase::Failed | UpdatePhase::RolledBack) {
            state.set_phase(UpdatePhase::Failed);
            state.last_error = Some(format!(
                "updater exited with {} before stopping the service, see its output log",
                status
            ));
        }

        if let Err(e) = self.update_handler_service.handle_failure(state).await {
            warn!(
                "Failed to finish the aborted update to {}: {:#}",
                target_version, e
            );
        }

        self.tool_run_manager.clear_client_update_pending().await;
        if let Err(e) = self.tool_run_manager.resume_after_update_failure().await {
            warn!(
                "Failed to resume tool supervision after the aborted update to {}: {:#}",
                target_version, e
            );
        }
    }

    /// Writes the extracted binary to a temp file (tmp + fsync + rename) for the updater script
    async fn stage_binary(&self, binary_bytes: &[u8], binary_name: &str) -> Result<PathBuf> {
        let temp_dir = std::env::temp_dir();
        let binary_path = temp_dir.join(format!(
            "openframe-update-{}-{}",
            Uuid::new_v4(),
            binary_name
        ));
        let tmp_path = binary_path.with_extension("tmp");
        let mut file = tokio::fs::File::create(&tmp_path)
            .await
            .context("Failed to create staged binary file")?;
        file.write_all(binary_bytes)
            .await
            .context("Failed to write staged binary")?;
        // write_all can leave the last chunk in flight, and sync_all would swallow its error
        file.flush()
            .await
            .context("Failed to complete staged binary write")?;
        file.sync_all()
            .await
            .context("Failed to fsync staged binary")?;
        drop(file);
        tokio::fs::rename(&tmp_path, &binary_path)
            .await
            .context("Failed to finalize staged binary")?;
        Ok(binary_path)
    }

    /// Parse version string into semver Version
    /// Supports formats like: "1.2.3", "v1.2.3", "1.2.3-beta", "1.2.3+build"
    fn parse_version(version: &str) -> Result<Version> {
        // Remove 'v' prefix if present
        let version = version.trim().trim_start_matches('v');

        Version::parse(version).with_context(|| format!("Failed to parse version: {}", version))
    }

    /// Validate version format (basic semver check)
    fn is_valid_version(version: &str) -> bool {
        !version.is_empty()
            && version
                .chars()
                .next()
                .map(|c| c.is_ascii_digit() || c == 'v')
                .unwrap_or(false)
            && version
                .trim_start_matches('v')
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '+')
    }
}
