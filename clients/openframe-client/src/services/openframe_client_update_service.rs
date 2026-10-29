use crate::config::update_config::{ALLOW_DOWNGRADE, STAGED_VERSION_PROBE_TIMEOUT_SECS};
use crate::models::openframe_client_info::ClientUpdateStatus;
use crate::models::openframe_client_update_message::OpenFrameClientUpdateMessage;
use crate::models::update_state::{UpdatePhase, UpdateState};
use crate::platform::directories::get_update_staging_directory;
use crate::platform::updater_launcher::{self, LaunchedUpdater, UpdaterParams};
use crate::service::FULL_SERVICE_NAME;
use crate::services::github_download_service::GithubDownloadService;
use crate::services::last_known_good_service::LastKnownGoodService;
use crate::services::openframe_client_info_service::OpenFrameClientInfoService;
use crate::services::tool_ops::ToolOps;
use crate::services::tool_run_manager::ToolRunManager;
use crate::services::update_handler_service::UpdateHandlerService;
use crate::services::update_state_service::UpdateStateService;
use crate::utils::fs::JsonFile;
use crate::utils::version_comparator;
use anyhow::{anyhow, Context, Result};
use semver::Version;
use std::path::{Path, PathBuf};
use std::process::{ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Debug, PartialEq)]
pub enum UpdateLaunch {
    Launched,
    Skipped,
}

/// Marks an update as in progress until dropped
pub struct UpdateGuard(Arc<AtomicBool>);

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
    tool_ops: ToolOps,
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
        tool_ops: ToolOps,
        update_handler_service: UpdateHandlerService,
    ) -> Self {
        Self {
            client_info_service,
            github_download_service,
            update_state_service,
            last_known_good_service,
            tool_run_manager,
            tool_ops,
            update_handler_service,
            update_in_progress: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn process_update(
        &self,
        message: OpenFrameClientUpdateMessage,
    ) -> Result<UpdateLaunch> {
        let guard = self.reserve(&message)?;
        self.apply(message, guard).await
    }

    /// Takes the update slot and parks new tool operations, unless another update or a tool holds them
    pub fn reserve(&self, message: &OpenFrameClientUpdateMessage) -> Result<UpdateGuard> {
        let requested_version = message.version.trim();
        info!("Received update request for version: {}", requested_version);

        // 1. Held until the updater is done with this process, so a redelivery cannot overlap a live script
        let Some(guard) = UpdateGuard::acquire(&self.update_in_progress) else {
            warn!(
                "Update already in progress, ignoring duplicate request for version: {}",
                requested_version
            );
            return Err(anyhow!("Update already in progress"));
        };
        info!("Acquired update lock for version: {}", requested_version);

        // apply() skips it anyway, so neither wait for busy tools nor park them
        if canonical_version(requested_version).as_deref() == Some(env!("OPENFRAME_VERSION")) {
            return Ok(guard);
        }

        self.tool_run_manager.mark_client_update_pending();

        if self.tool_ops.any_busy() {
            warn!(
                "Tool operation in progress, deferring client update to version {} (will retry)",
                requested_version
            );
            return Err(anyhow!(
                "Tool operation in progress, deferring client update"
            ));
        }
        Ok(guard)
    }

    pub fn tools_busy(&self) -> bool {
        self.tool_ops.any_busy()
    }

    /// Update processing with version validation and safety checks, under a reserved update slot
    pub async fn apply(
        &self,
        message: OpenFrameClientUpdateMessage,
        guard: UpdateGuard,
    ) -> Result<UpdateLaunch> {
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
            self.tool_run_manager.clear_client_update_pending();
            return Ok(UpdateLaunch::Skipped);
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
                    Ok(anchor_semver)
                        if version_comparator::precedence(&requested_semver, &anchor_semver)
                            == std::cmp::Ordering::Less =>
                    {
                        warn!(
                            "refusing downgrade to {} — anchored at {}",
                            requested_version, anchor
                        );
                        self.tool_run_manager.clear_client_update_pending();
                        return Ok(UpdateLaunch::Skipped);
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
        }

        update_result.map(|()| UpdateLaunch::Launched)
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

        self.tool_run_manager.mark_client_update_pending();

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

        // A wrong build would only be rolled back after the service stop and swap
        if let Err(e) =
            Self::verify_staged_version(&staged_path, &update_state.target_version).await
        {
            error!("{:#}", e);
            if let Err(cleanup_err) = std::fs::remove_file(&staged_path) {
                warn!(
                    "Failed to remove staged binary after the version check: {}",
                    cleanup_err
                );
            }
            self.update_state_service.clear().await?;
            return Err(e);
        }

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

        if self.tool_ops.any_busy() {
            warn!("Tool operation started during client download, deferring client update (will retry)");
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

        let mut state = match self.update_state_service.read_state().await {
            Ok(JsonFile::Parsed(state)) => state,
            Ok(JsonFile::Missing) => {
                warn!(
                    "Updater for {} exited early and the update state is gone (client uninstalled?), nothing to finish",
                    target_version
                );
                return;
            }
            Ok(JsonFile::Corrupt) => UpdateState::new(target_version.to_string()),
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

        self.tool_run_manager.clear_client_update_pending();
        if let Err(e) = self.tool_run_manager.resume_after_update_failure().await {
            warn!(
                "Failed to resume tool supervision after the aborted update to {}: {:#}",
                target_version, e
            );
        }
    }

    /// Writes the extracted binary to the staging dir for the updater script. The UUID name means
    /// nothing can read it before we return, so no atomic-rename or fsync ceremony is needed.
    async fn stage_binary(&self, binary_bytes: &[u8], binary_name: &str) -> Result<PathBuf> {
        let staging_dir = get_update_staging_directory();
        tokio::fs::create_dir_all(&staging_dir)
            .await
            .context("Failed to create update staging directory")?;
        let binary_path = staging_dir.join(format!(
            "openframe-update-{}-{}",
            Uuid::new_v4(),
            binary_name
        ));
        tokio::fs::write(&binary_path, binary_bytes)
            .await
            .context("Failed to write staged binary")?;
        Ok(binary_path)
    }

    /// Fails only when the staged binary clearly reports another version; a probe that cannot tell lets the update go ahead.
    async fn verify_staged_version(staged_path: &Path, expected_version: &str) -> Result<()> {
        let Some(staged_version) = Self::staged_binary_version(staged_path).await else {
            return Ok(());
        };
        let Some(expected) = version_comparator::parse_version(expected_version) else {
            return Ok(());
        };
        if version_comparator::precedence(&staged_version, &expected) != std::cmp::Ordering::Equal {
            return Err(anyhow!(
                "Downloaded binary reports version {}, expected {}; not installing it",
                staged_version,
                expected_version
            ));
        }
        info!(
            "Downloaded binary reports the expected version {}",
            staged_version
        );
        Ok(())
    }

    async fn staged_binary_version(staged_path: &Path) -> Option<Version> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Err(e) =
                tokio::fs::set_permissions(staged_path, std::fs::Permissions::from_mode(0o755))
                    .await
            {
                warn!(
                    "Cannot make the downloaded binary executable to check its version, updating anyway: {}",
                    e
                );
                return None;
            }
        }

        let mut command = tokio::process::Command::new(staged_path);
        command
            .arg("--version")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        #[cfg(windows)]
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = match tokio::time::timeout(
            Duration::from_secs(STAGED_VERSION_PROBE_TIMEOUT_SECS),
            command.output(),
        )
        .await
        {
            Ok(Ok(output)) => output,
            Ok(Err(e)) => {
                warn!(
                    "Cannot run the downloaded binary to check its version, updating anyway: {}",
                    e
                );
                return None;
            }
            Err(_) => {
                warn!(
                    "Downloaded binary did not print its version within {}s, updating anyway",
                    STAGED_VERSION_PROBE_TIMEOUT_SECS
                );
                return None;
            }
        };
        let stdout = String::from_utf8_lossy(&output.stdout);
        if !output.status.success() {
            warn!(
                "Downloaded binary exited with {} on --version, updating anyway: {}",
                output.status,
                stdout.trim()
            );
            return None;
        }
        let version = parse_version_output(&stdout);
        if version.is_none() {
            warn!(
                "Downloaded binary printed no version, updating anyway: {}",
                stdout.trim()
            );
        }
        version
    }

    /// Parse version string into semver Version
    /// Supports formats like: "1.2.3", "v1.2.3", "1.2.3-beta", "1.2.3+build"
    fn parse_version(version: &str) -> Result<Version> {
        version_comparator::parse_version(version)
            .with_context(|| format!("Failed to parse version: {}", version))
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

/// The version as apply() compares it with the running one; None for a version apply() rejects.
pub(crate) fn canonical_version(version: &str) -> Option<String> {
    let version = version.trim();
    if !OpenFrameClientUpdateService::is_valid_version(version) {
        return None;
    }
    version_comparator::parse_version(version).map(|parsed| parsed.to_string())
}

/// Reads clap's `openframe-client <version>` line.
fn parse_version_output(stdout: &str) -> Option<Version> {
    stdout.lines().find_map(|line| {
        line.split_whitespace()
            .last()
            .and_then(version_comparator::parse_version)
    })
}

#[cfg(test)]
#[path = "openframe_client_update_service_tests.rs"]
mod tests;
