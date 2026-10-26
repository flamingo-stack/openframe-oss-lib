use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tracing::{info, warn};

use crate::clients::AuthClient;
use crate::config::updater_config::{
    BOOT_MARKER_POLL_INTERVAL_SECS, BOOT_MARKER_WAIT_SECS, CLIENT_SERVICE_FULL_NAME,
    DOWNLOAD_CLIENT_TIMEOUT_SECS, SERVICE_START_VERIFY_WAIT_SECS,
};
use crate::listener::ClientUpdateListener;
use crate::models::UpdaterPhase;
use crate::platform::DirectoryManager;
use crate::services::boot_marker_service::BootMarkerService;
use crate::services::client_binary::{self, Restore};
use crate::services::token_provider::TokenProvider;
use crate::services::{
    AgentConfigurationService, ClientToolOpProbe, ClientUpdateService, GithubDownloadService,
    InitialConfigurationService, LocalTlsConfigProvider, NatsConnectionManager,
    NatsMessagePublisher, ServiceManagerService, UpdateProgressPublisher, UpdaterStateService,
};

/// Outcome of crash recovery — recovery itself is purely local; the report is
/// published once NATS is up.
enum RecoveryReport {
    Success {
        version: String,
    },
    Failure {
        version: String,
        reason: String,
        rolled_back: bool,
    },
}

pub struct UpdaterOrchestrator {
    dir_manager: DirectoryManager,
}

impl UpdaterOrchestrator {
    pub fn new(dir_manager: DirectoryManager) -> Self {
        Self { dir_manager }
    }

    pub async fn start(&self) -> Result<()> {
        let initial_config_service = InitialConfigurationService::new(&self.dir_manager)
            .context("Failed to init initial configuration service")?;

        let agent_config_service = AgentConfigurationService::new(&self.dir_manager)
            .context("Failed to init agent configuration service")?;

        // Before the token wait and NATS connect: a machine that crashed
        // mid-swap while offline must get its client binary back without the
        // network.
        let state_service = UpdaterStateService::new(&self.dir_manager);
        let boot_marker = BootMarkerService::new(&self.dir_manager);
        state_service.cleanup_legacy_state();
        let recovery_report = self
            .recover_from_crash(&state_service, &boot_marker)
            .await?;
        if !state_service.state_file_path().exists() {
            // Nothing in flight any more: staged binaries and backups next to the
            // client are what interrupted updates left behind.
            client_binary::sweep_leftovers(&ServiceManagerService::client_binary_path());
        }

        let server_host = initial_config_service
            .get_server_url()
            .context("Failed to read server_host from initial_config.json")?;

        let ws_url = format!("wss://{}", server_host);

        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .danger_accept_invalid_certs(initial_config_service.is_local_mode()?)
            .no_proxy()
            .pool_max_idle_per_host(0)
            .build()
            .context("Failed to build HTTP client")?;

        // The general-purpose client's total-request timeout would cap a slow
        // download below DOWNLOAD_CLIENT_TIMEOUT_SECS.
        let download_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(DOWNLOAD_CLIENT_TIMEOUT_SECS))
            .danger_accept_invalid_certs(initial_config_service.is_local_mode()?)
            .no_proxy()
            .pool_max_idle_per_host(0)
            .build()
            .context("Failed to build download HTTP client")?;

        // Token supply: primary is shared_token.enc written by openframe-client;
        // if the client stops refreshing it, the provider authenticates on its own
        // via client_credentials from agent_config.json (held in memory only).
        let token_file_path = self.dir_manager.secured_dir().join("shared_token.enc");
        info!(
            "Starting token provider (file: {})",
            token_file_path.display()
        );
        let auth_client = AuthClient::new(format!("https://{}", server_host), http_client.clone());
        let token =
            TokenProvider::start(token_file_path, auth_client, agent_config_service.clone());

        // Wait for the initial token before connecting to NATS. The provider
        // self-authenticates when the shared file is missing or stale, so this
        // resolves even if openframe-client is down.
        info!("Waiting for an access token to become available");
        loop {
            if token.read().await.is_some() {
                info!("Access token available");
                break;
            }
            warn!("No access token yet — retrying in 10 seconds");
            tokio::time::sleep(Duration::from_secs(10)).await;
        }

        let tls_config_provider = LocalTlsConfigProvider::new(initial_config_service.clone());

        let nats_manager = NatsConnectionManager::new(
            ws_url,
            agent_config_service.clone(),
            initial_config_service.clone(),
            token,
            tls_config_provider,
        );

        nats_manager
            .connect()
            .await
            .context("Failed to connect to NATS")?;
        info!("NATS connected");
        nats_manager.start_connection_watchdog();

        // The updater only writes its own .log file; openframe-client tails it and ships
        // it to NATS (LogSourceKind::Updater), the same way it handles the MeshCentral
        // agent log. The updater does not run its own log-streaming pipeline.

        let nats_publisher = NatsMessagePublisher::new(nats_manager.clone());

        let machine_id = agent_config_service
            .get_machine_id()
            .await
            .context("Failed to read machine_id")?;

        let progress_publisher = UpdateProgressPublisher::new(nats_publisher, machine_id.clone());

        match recovery_report {
            Some(RecoveryReport::Success { version }) => {
                progress_publisher.publish_success(&version).await;
            }
            Some(RecoveryReport::Failure {
                version,
                reason,
                rolled_back,
            }) => {
                progress_publisher
                    .publish_failure(&UpdaterPhase::Failed, &version, &reason, rolled_back)
                    .await;
            }
            None => {}
        }

        progress_publisher.publish_updater_version().await;

        let download_service = GithubDownloadService::new(download_client);

        let update_service = ClientUpdateService::new(
            download_service,
            state_service,
            progress_publisher,
            boot_marker,
            ClientToolOpProbe::new(&self.dir_manager),
        );

        let listener =
            ClientUpdateListener::new(nats_manager, update_service, agent_config_service);

        info!("Updater ready — listening for update commands");
        let handle = listener.start().await;
        handle.await.ok();

        Ok(())
    }

    async fn recover_from_crash(
        &self,
        state_service: &UpdaterStateService,
        boot_marker: &BootMarkerService,
    ) -> Result<Option<RecoveryReport>> {
        let state = match state_service.load() {
            Ok(None) => return Ok(None),
            Ok(Some(s)) => s,
            Err(e) => {
                // An unreadable state file must not crash-loop the service via KeepAlive —
                // drop it and start clean; the NATS message redelivers any lost update.
                warn!(
                    "Updater state file unreadable — removing it and skipping crash recovery: {:#}",
                    e
                );
                if let Err(remove_err) = std::fs::remove_file(state_service.state_file_path()) {
                    warn!("Failed to remove unreadable state file: {}", remove_err);
                }
                return Ok(None);
            }
        };

        info!(
            phase = %state.phase,
            version = %state.target_version,
            "Crash recovery: found pending state"
        );

        let version = &state.target_version;
        let target = ServiceManagerService::client_binary_path();

        let report = match state.phase {
            UpdaterPhase::Downloading | UpdaterPhase::Verifying | UpdaterPhase::Idle => {
                if let Some(path) = &state.downloaded_binary_path {
                    client_binary::remove_quietly(path, "temp binary");
                }
                let report = RecoveryReport::Failure {
                    version: version.clone(),
                    reason: "Updater crashed before stopping service — no changes made".to_string(),
                    rolled_back: false,
                };
                state_service.clear()?;
                Some(report)
            }

            UpdaterPhase::StoppingService | UpdaterPhase::ReplacingBinary => {
                let report = self
                    .restore_and_start(&state.backup_path, &target, version, boot_marker)
                    .await;
                state_service.clear()?;
                Some(report)
            }

            // The boot marker was cleared before StartingService, so in these
            // phases the marker is the source of truth: only a marker carrying
            // the target version proves the new binary booted. The marker alone
            // proves a *past* boot though — success additionally requires the
            // service to be running now (started here if needed). A state query
            // that keeps failing is "unknown", never grounds for a restore.
            UpdaterPhase::StartingService | UpdaterPhase::VerifyingBoot => {
                if ServiceManagerService::query_running(CLIENT_SERVICE_FULL_NAME).await
                    != Some(true)
                {
                    info!("Crash recovery: service not confirmed running — attempting start");
                    if let Err(e) =
                        ServiceManagerService::start_async(CLIENT_SERVICE_FULL_NAME).await
                    {
                        warn!("Crash recovery: start failed: {:#}", e);
                    }
                    tokio::time::sleep(Duration::from_secs(SERVICE_START_VERIFY_WAIT_SECS)).await;
                }

                let mut verified =
                    boot_marker.boot_marker_version().as_deref() == Some(version.as_str());
                if !verified {
                    // Give the (possibly just-started) binary one marker window
                    // before restoring the backup.
                    let mut elapsed = 0u64;
                    while elapsed < BOOT_MARKER_WAIT_SECS {
                        if boot_marker.boot_marker_version().as_deref() == Some(version.as_str()) {
                            verified = true;
                            break;
                        }
                        tokio::time::sleep(Duration::from_secs(BOOT_MARKER_POLL_INTERVAL_SECS))
                            .await;
                        elapsed += BOOT_MARKER_POLL_INTERVAL_SECS;
                    }
                }

                let running = ServiceManagerService::query_running(CLIENT_SERVICE_FULL_NAME).await;
                if running.is_none() {
                    warn!("Crash recovery: service state unknown after retries — trusting the boot marker");
                }

                let report = if verified && running != Some(false) {
                    info!("Crash recovery: boot marker matches target and service is running — marking success");
                    RecoveryReport::Success {
                        version: version.clone(),
                    }
                } else {
                    warn!(
                        "Crash recovery: not healthy (marker verified: {}, running: {:?}) — restoring the previous binary",
                        verified, running
                    );
                    self.restore_and_start(&state.backup_path, &target, version, boot_marker)
                        .await
                };
                state_service.clear()?;
                Some(report)
            }

            UpdaterPhase::Completed | UpdaterPhase::Failed => {
                info!("Crash recovery: clearing terminal state ({})", state.phase);
                state_service.clear()?;
                None
            }
        };

        Ok(report)
    }

    async fn restore_and_start(
        &self,
        backup_path: &Option<PathBuf>,
        target: &Path,
        version: &str,
        boot_marker: &BootMarkerService,
    ) -> RecoveryReport {
        let failure = |reason: &str, rolled_back: bool| RecoveryReport::Failure {
            version: version.to_string(),
            reason: reason.to_string(),
            rolled_back,
        };

        let Some(backup) = backup_path.as_ref().filter(|p| p.exists()) else {
            if target.exists() {
                info!("Crash recovery: no backup left to restore — starting the client binary in place");
                if let Err(e) = ServiceManagerService::start_async(CLIENT_SERVICE_FULL_NAME).await {
                    warn!("Crash recovery: failed to start service: {:#}", e);
                }
                return failure(
                    "Updater crashed mid-update; client binary left in place",
                    false,
                );
            }
            return failure(
                "Updater crashed mid-update, no client binary and no backup available",
                false,
            );
        };

        match client_binary::restore_previous_binary(backup, target, boot_marker).await {
            Restore::Restored => failure("Updater crashed mid-update, previous binary restored", true),
            Restore::RestoredNotStarted(e) => failure(
                &format!(
                    "Updater crashed mid-update, previous binary restored but its service did not start: {}",
                    e
                ),
                true,
            ),
            Restore::Failed => failure(
                "Updater crashed mid-update and restoring the previous binary failed",
                false,
            ),
        }
    }
}
