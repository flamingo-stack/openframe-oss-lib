use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tracing::{error, info, warn};

use crate::clients::AuthClient;
use crate::config::updater_config::{
    BOOT_MARKER_POLL_INTERVAL_SECS, BOOT_MARKER_WAIT_SECS, CLIENT_SERVICE_FULL_NAME,
    DOWNLOAD_CLIENT_TIMEOUT_SECS, SERVICE_START_VERIFY_WAIT_SECS,
};
use crate::listener::ClientUpdateListener;
use crate::models::UpdaterPhase;
use crate::platform::{atomic_replace, DirectoryManager};
use crate::services::last_known_good_service::LastKnownGoodService;
use crate::services::token_provider::TokenProvider;
use crate::services::{
    AgentConfigurationService, ClientToolOpProbe, ClientUpdateService, GithubDownloadService,
    InitialConfigurationService, LocalTlsConfigProvider, NatsConnectionManager,
    NatsMessagePublisher, ServiceManagerService, UpdateProgressPublisher, UpdaterStateService,
};
use crate::utils::blocking::run_blocking;

/// Outcome of crash recovery — recovery itself is purely local; the report is
/// published once NATS is up.
enum RecoveryReport {
    Success {
        version: String,
    },
    Failure {
        phase: UpdaterPhase,
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
        let lkg_service = LastKnownGoodService::new(
            &self.dir_manager,
            ServiceManagerService::client_binary_path(),
        );
        state_service.cleanup_legacy_state();
        let recovery_report = self
            .recover_from_crash(&state_service, &lkg_service)
            .await?;

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
                phase,
                version,
                reason,
                rolled_back,
            }) => {
                progress_publisher
                    .publish_failure(&phase, &version, &reason, rolled_back)
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
            lkg_service,
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
        lkg_service: &LastKnownGoodService,
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
                    let p = PathBuf::from(path);
                    if p.exists() {
                        if let Err(e) = std::fs::remove_file(&p) {
                            warn!("Failed to remove temp binary during recovery: {}", e);
                        }
                    }
                }
                let report = RecoveryReport::Failure {
                    phase: UpdaterPhase::Failed,
                    version: version.clone(),
                    reason: "Updater crashed before stopping service — no changes made".to_string(),
                    rolled_back: false,
                };
                state_service.clear()?;
                Some(report)
            }

            UpdaterPhase::StoppingService | UpdaterPhase::ReplacingBinary => {
                let report = self
                    .restore_and_start(&state.backup_path, &target, version)
                    .await;
                state_service.clear()?;
                Some(report)
            }

            // The boot marker was cleared before StartingService, so in these
            // phases the marker is the source of truth: only a marker carrying
            // the target version proves the new binary booted. The marker alone
            // proves a *past* boot though — promotion additionally requires the
            // service to be running now (started here if needed). A state query
            // that keeps failing is "unknown", never grounds for a rollback.
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
                    lkg_service.boot_marker_version().as_deref() == Some(version.as_str());
                if !verified {
                    // Give the (possibly just-started) binary one marker window
                    // before restoring the backup.
                    let mut elapsed = 0u64;
                    while elapsed < BOOT_MARKER_WAIT_SECS {
                        if lkg_service.boot_marker_version().as_deref() == Some(version.as_str()) {
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
                    let promoted = {
                        let (lkg, version) = (lkg_service.clone(), version.clone());
                        run_blocking(move || lkg.promote(&version)).await
                    };
                    if let Err(e) = promoted {
                        warn!(
                            "Crash recovery: failed to raise last-known-good anchor to {}: {:#}",
                            version, e
                        );
                    }
                    RecoveryReport::Success {
                        version: version.clone(),
                    }
                } else {
                    warn!(
                        "Crash recovery: not healthy (marker verified: {}, running: {:?}) — restoring the previous binary",
                        verified, running
                    );
                    self.restore_and_start(&state.backup_path, &target, version)
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
        backup_path: &Option<String>,
        target: &Path,
        version: &str,
    ) -> RecoveryReport {
        let Some(backup) = backup_path
            .as_ref()
            .map(PathBuf::from)
            .filter(|p| p.exists())
        else {
            if target.exists() {
                info!("Crash recovery: no backup left to restore — starting the client binary in place");
                if let Err(e) = ServiceManagerService::start_async(CLIENT_SERVICE_FULL_NAME).await {
                    error!("Crash recovery: failed to start service: {}", e);
                }
                return RecoveryReport::Failure {
                    phase: UpdaterPhase::Failed,
                    version: version.to_string(),
                    reason: "Updater crashed mid-update; client binary left in place".to_string(),
                    rolled_back: false,
                };
            }
            return RecoveryReport::Failure {
                phase: UpdaterPhase::Failed,
                version: version.to_string(),
                reason: "Updater crashed mid-update, no client binary and no backup available"
                    .to_string(),
                rolled_back: false,
            };
        };

        let restored = {
            let (backup, target) = (backup.clone(), target.to_path_buf());
            run_blocking(move || atomic_replace::restore(&backup, &target)).await
        };
        if let Err(e) = restored {
            error!(
                "Crash recovery: restore from {} failed: {:#}",
                backup.display(),
                e
            );
            return RecoveryReport::Failure {
                phase: UpdaterPhase::Failed,
                version: version.to_string(),
                reason: "Updater crashed mid-update and restoring the previous binary failed"
                    .to_string(),
                rolled_back: false,
            };
        }
        info!(
            "Crash recovery: restored client binary from {}",
            backup.display()
        );

        if let Err(e) = ServiceManagerService::start_async(CLIENT_SERVICE_FULL_NAME).await {
            error!("Crash recovery: failed to start restored service: {}", e);
        }
        RecoveryReport::Failure {
            phase: UpdaterPhase::Failed,
            version: version.to_string(),
            reason: "Updater crashed mid-update, previous binary restored".to_string(),
            rolled_back: true,
        }
    }
}
