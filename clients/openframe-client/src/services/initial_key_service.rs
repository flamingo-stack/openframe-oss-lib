use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use std::sync::Arc;
use tokio::task::JoinHandle;
use tokio::time::Duration;
use tracing::{error, info};

use crate::services::backend_call_retry::{retry_until_settled, RetryTiming};
use crate::services::deactivation_service::DeactivationService;
use crate::services::{AgentConfigurationService, InitialConfigurationService};

const RETRY_INTERVAL: Duration = Duration::from_secs(60);

#[derive(Deserialize)]
struct RegistrationSecretResponse {
    key: String,
}

pub struct InitialKeyService {
    http_client: Client,
    base_url: String,
    initial_config_service: InitialConfigurationService,
    agent_config_service: AgentConfigurationService,
    deactivation: Arc<DeactivationService>,
    timing: RetryTiming,
}

impl InitialKeyService {
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
            timing: RetryTiming::fixed(RETRY_INTERVAL),
        }
    }

    /// Fetches the initial key in the background when the config lacks one; no-op otherwise.
    pub fn start(self: Arc<Self>) -> Option<JoinHandle<()>> {
        if !self.is_key_missing() {
            return None;
        }

        info!("Initial key missing in config, starting background fetch (legacy upgrade)");

        Some(tokio::spawn(async move {
            let secret =
                retry_until_settled(&self.deactivation, self.timing, "fetch initial key", || {
                    self.fetch_registration_secret()
                })
                .await;
            match self.initial_config_service.update_initial_key(secret) {
                Ok(()) => info!("Successfully fetched and saved initial key from server"),
                Err(e) => error!("Failed to save initial key: {:#}", e),
            }
        }))
    }

    fn is_key_missing(&self) -> bool {
        self.initial_config_service
            .is_initial_key_missing()
            .unwrap_or(false)
    }

    async fn fetch_registration_secret(&self) -> Result<String> {
        let url = format!("{}/clients/agent/registration-secret/active", self.base_url);
        let token = self.agent_config_service.get_access_token().await?;

        let response = self
            .http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .context("Failed to fetch registration secret")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("HTTP {} - {}", status, body);
        }

        let resp: RegistrationSecretResponse = response.json().await?;
        Ok(resp.key)
    }
}

#[cfg(test)]
#[path = "initial_key_service_tests.rs"]
mod tests;
