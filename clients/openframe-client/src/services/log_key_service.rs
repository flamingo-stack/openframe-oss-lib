use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::Notify;
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};

use crate::services::backend_call_retry::{retry_until_settled, RetryTiming};
use crate::services::deactivation_service::DeactivationService;
use crate::services::{AgentConfigurationService, InitialConfigurationService};

const ERROR_BODY_CHARS: usize = 200;
const RETRY_TIMING: RetryTiming = RetryTiming {
    initial: Duration::from_secs(30),
    max: Duration::from_secs(600),
};

#[derive(Deserialize)]
struct LogKeyResponse {
    key: String,
}

/// Fetches the per-tenant logs-stream key, with the agent token, when the config lacks one or the logs gateway rejects it.
pub struct LogKeyService {
    http_client: Client,
    base_url: String,
    initial_config_service: InitialConfigurationService,
    agent_config_service: AgentConfigurationService,
    deactivation: Arc<DeactivationService>,
    timing: RetryTiming,
    rejected: Notify,
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
            rejected: Notify::new(),
        }
    }

    /// Called by the logs stream when the gateway rejects the key it presented.
    pub fn key_rejected(&self) {
        self.rejected.notify_one();
    }

    /// Runs once the device is registered: fetches the log key when the config lacks one, or again after a rejection, and returns once a key different from the saved one is saved, which the stream only uses after a client restart.
    pub async fn run(&self) {
        if self.is_key_missing() {
            info!("Log key missing in config, starting background fetch");
        } else {
            self.drop_initial_key();
            self.rejected.notified().await;
        }
        loop {
            let key = retry_until_settled(&self.deactivation, self.timing, "fetch log key", || {
                self.fetch_log_key()
            })
            .await;
            match self.store_if_changed(key) {
                Ok(true) => return,
                Ok(false) => warn!("Logs gateway rejected the log key the server still returns"),
                Err(e) => error!("Failed to save log key: {:#}", e),
            }
            sleep(self.timing.max).await;
            self.rejected.notified().await;
        }
    }

    fn is_key_missing(&self) -> bool {
        self.initial_config_service
            .get_log_key()
            .map(|key| key.is_empty())
            .unwrap_or(false)
    }

    fn store_if_changed(&self, key: String) -> Result<bool> {
        if self.initial_config_service.get_log_key()? == key {
            return Ok(false);
        }
        self.initial_config_service.save_log_key(key)?;
        info!("Log key saved");
        self.drop_initial_key();
        Ok(true)
    }

    // A registered device holding a log key has no use for the enrollment key; stop keeping it on disk.
    fn drop_initial_key(&self) {
        if let Err(e) = self.initial_config_service.clear_initial_key() {
            warn!("Failed to clear the initial key: {:#}", e);
        }
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
