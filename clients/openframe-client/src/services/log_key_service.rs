use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use std::sync::Arc;
use tokio::task::JoinHandle;
use tokio::time::Duration;
use tracing::{error, info, warn};

use crate::services::backend_call_retry::{retry_until_settled, RetryTiming};
use crate::services::deactivation_service::DeactivationService;
use crate::services::{AgentConfigurationService, InitialConfigurationService};

const ERROR_BODY_CHARS: usize = 200;
const RETRY_TIMING: RetryTiming = RetryTiming {
    initial: Duration::from_secs(30),
    max: Duration::from_secs(3600),
};

#[derive(Deserialize)]
struct LogKeyResponse {
    key: String,
}

/// Keeps the per-tenant key the logs stream authenticates with, fetched with the agent token.
pub struct LogKeyService {
    http_client: Client,
    base_url: String,
    initial_config_service: InitialConfigurationService,
    agent_config_service: AgentConfigurationService,
    deactivation: Arc<DeactivationService>,
    timing: RetryTiming,
}

impl LogKeyService {
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
            timing: RETRY_TIMING,
        }
    }

    /// Fetches the log key in the background when the config lacks one (registered before log keys existed); no-op otherwise.
    pub fn start(self: Arc<Self>) -> Option<JoinHandle<()>> {
        if !self.is_key_missing() {
            return None;
        }

        info!("Log key missing in config, starting background fetch");

        Some(tokio::spawn(async move {
            let key = retry_until_settled(&self.deactivation, self.timing, "fetch log key", || {
                self.fetch_log_key()
            })
            .await;
            if let Err(e) = self.store(key).await {
                error!("Failed to save log key: {:#}", e);
            }
        }))
    }

    pub fn stored_key(&self) -> Option<String> {
        self.agent_config_service
            .get_log_key()
            .ok()
            .filter(|key| !key.is_empty())
    }

    fn is_key_missing(&self) -> bool {
        self.agent_config_service
            .get_log_key()
            .map(|key| key.is_empty())
            .unwrap_or(false)
    }

    async fn store(&self, key: String) -> Result<()> {
        self.agent_config_service.save_log_key(key).await?;
        info!("Log key saved");
        // The enrollment key has no use once the device holds a log key; stop keeping it on disk.
        if let Err(e) = self.initial_config_service.clear_initial_key() {
            warn!("Failed to clear the initial key: {:#}", e);
        }
        Ok(())
    }

    async fn fetch_log_key(&self) -> Result<String> {
        let url = format!("{}/clients/agent/log-key", self.base_url);
        let token = self.agent_config_service.get_access_token().await?;

        let response = self
            .http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .context("Failed to fetch log key")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            let body: String = body.chars().take(ERROR_BODY_CHARS).collect();
            anyhow::bail!("HTTP {} - {}", status, body);
        }

        let resp: LogKeyResponse = response.json().await?;
        anyhow::ensure!(!resp.key.is_empty(), "Server returned an empty log key");
        Ok(resp.key)
    }
}

#[cfg(test)]
#[path = "log_key_service_tests.rs"]
mod tests;
