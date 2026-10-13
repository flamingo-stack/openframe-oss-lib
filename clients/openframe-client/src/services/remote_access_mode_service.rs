use std::sync::Arc;

use anyhow::{Context, Result};
use reqwest::{Client, StatusCode};
use serde_json::json;
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};

use crate::services::deactivation_service::DeactivationService;
use crate::services::{AgentConfigurationService, InitialConfigurationService};

const DEVICE_MODE_PATH: &str = "/clients/api/v1/remote-access/device-mode";

/// Retry delays; production values by default, shrunk in tests.
#[derive(Debug, Clone, Copy)]
struct RetryTiming {
    initial: Duration,
    max: Duration,
}

impl Default for RetryTiming {
    fn default() -> Self {
        Self {
            initial: Duration::from_secs(30),
            max: Duration::from_secs(30 * 60),
        }
    }
}

/// How the backend answered a device-mode call; every variant ends the pending state.
#[derive(Debug, PartialEq, Eq)]
enum Outcome {
    Applied,
    NotSupported,
    OverrideExists,
}

/// Forwards the install-time `--remote-access-mode` to the backend as the device override.
pub struct RemoteAccessModeService {
    http_client: Client,
    base_url: String,
    initial_config_service: InitialConfigurationService,
    agent_config_service: AgentConfigurationService,
    deactivation: Arc<DeactivationService>,
    timing: RetryTiming,
}

impl RemoteAccessModeService {
    pub fn new(
        http_client: Client,
        base_url: String,
        initial_config_service: InitialConfigurationService,
        agent_config_service: AgentConfigurationService,
        deactivation: Arc<DeactivationService>,
    ) -> Self {
        Self {
            http_client,
            base_url,
            initial_config_service,
            agent_config_service,
            deactivation,
            timing: RetryTiming::default(),
        }
    }

    /// Sends a pending mode in the background until the backend settles it; no-op without one.
    pub fn start(self: Arc<Self>) -> Option<tokio::task::JoinHandle<()>> {
        let mode = match self.initial_config_service.get_remote_access_mode() {
            Ok(Some(mode)) => mode,
            Ok(None) => return None,
            Err(e) => {
                error!("Failed to read the pending remote access mode: {:#}", e);
                return None;
            }
        };

        info!(
            "Setting install-time remote access mode {} on this device",
            mode
        );
        Some(tokio::spawn(async move { self.apply(&mode).await }))
    }

    async fn apply(&self, mode: &str) {
        let mut delay = self.timing.initial;
        loop {
            if self.deactivation.is_suspended() {
                sleep(delay).await;
                continue;
            }
            match self.send(mode).await {
                Ok(outcome) => {
                    match outcome {
                        Outcome::Applied => info!("Remote access mode {} set on this device", mode),
                        Outcome::NotSupported => warn!(
                            "Backend does not support setting the remote access mode; dropping {}",
                            mode
                        ),
                        Outcome::OverrideExists => warn!(
                            "Device already has a different remote access mode; keeping it and dropping {}",
                            mode
                        ),
                    }
                    if let Err(e) = self.initial_config_service.clear_remote_access_mode(mode) {
                        error!("Failed to clear the pending remote access mode: {:#}", e);
                    }
                    return;
                }
                Err(e) => {
                    warn!(
                        "Failed to set remote access mode {}: {:#}. Retrying in {}s",
                        mode,
                        e,
                        delay.as_secs()
                    );
                    sleep(delay).await;
                    delay = (delay * 2).min(self.timing.max);
                }
            }
        }
    }

    async fn send(&self, mode: &str) -> Result<Outcome> {
        let url = format!("{}{}", self.base_url, DEVICE_MODE_PATH);
        let token = self.agent_config_service.get_access_token().await?;

        let response = self
            .http_client
            .put(&url)
            .header("Authorization", format!("Bearer {}", token))
            .json(&json!({ "mode": mode }))
            .send()
            .await
            .context("Failed to call the device-mode endpoint")?;

        match response.status() {
            status if status.is_success() => Ok(Outcome::Applied),
            StatusCode::NOT_FOUND => Ok(Outcome::NotSupported),
            StatusCode::CONFLICT => Ok(Outcome::OverrideExists),
            status => {
                let body = response.text().await.unwrap_or_default();
                anyhow::bail!("HTTP {} - {}", status, body)
            }
        }
    }
}

#[cfg(test)]
#[path = "remote_access_mode_service_tests.rs"]
mod tests;
