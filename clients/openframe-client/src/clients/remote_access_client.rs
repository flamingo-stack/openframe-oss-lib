use anyhow::{Context, Result};
use reqwest::{Client, StatusCode};
use serde_json::json;

use crate::models::RemoteAccessMode;
use crate::services::agent_configuration_service::AgentConfigurationService;

const DEVICE_MODE_PATH: &str = "/clients/api/v1/remote-access/device-mode";

/// How the backend settled a device-mode call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeviceModeOutcome {
    Applied,
    NotSupported,
    OverrideExists,
}

#[derive(Clone)]
pub struct RemoteAccessClient {
    http_client: Client,
    base_url: String,
    config_service: AgentConfigurationService,
}

impl RemoteAccessClient {
    pub fn new(
        http_client: Client,
        base_url: String,
        config_service: AgentConfigurationService,
    ) -> Self {
        Self {
            http_client,
            base_url,
            config_service,
        }
    }

    /// Sets this device's remote access override; an `Err` means the call is worth retrying.
    pub async fn set_device_mode(&self, mode: RemoteAccessMode) -> Result<DeviceModeOutcome> {
        let url = format!("{}{}", self.base_url, DEVICE_MODE_PATH);
        let token = self.config_service.get_access_token().await?;

        let response = self
            .http_client
            .put(&url)
            .header("Authorization", format!("Bearer {}", token))
            .json(&json!({ "mode": mode }))
            .send()
            .await
            .context("Failed to call the device-mode endpoint")?;

        let status = response.status();
        match classify(status) {
            Some(outcome) => Ok(outcome),
            None => {
                let body = response.text().await.unwrap_or_default();
                anyhow::bail!("HTTP {} - {}", status, body)
            }
        }
    }
}

/// Statuses that settle a device-mode call; `None` for everything worth retrying.
fn classify(status: StatusCode) -> Option<DeviceModeOutcome> {
    match status {
        status if status.is_success() => Some(DeviceModeOutcome::Applied),
        StatusCode::NOT_FOUND => Some(DeviceModeOutcome::NotSupported),
        StatusCode::CONFLICT => Some(DeviceModeOutcome::OverrideExists),
        _ => None,
    }
}

#[cfg(test)]
#[path = "remote_access_client_tests.rs"]
mod tests;
