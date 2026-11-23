use anyhow::{Context, Result};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, warn};

use crate::models::AgentConfiguration;
use crate::platform::directories::DirectoryManager;
use crate::platform::machine_info_persistence::PersistedMachineInfo;
use crate::utils::fs::{atomic_write, quarantine_path, read_json, CorruptJson};

#[derive(Clone)]
pub struct AgentConfigurationService {
    config_file_path: PathBuf,
    // Serializes read-modify-write of the config so concurrent savers can't lose each other's fields.
    write_lock: Arc<Mutex<()>>,
}

impl AgentConfigurationService {
    pub fn new(directory_manager: DirectoryManager) -> Result<Self> {
        let config_file_path = directory_manager.secured_dir().join("agent_config.json");

        directory_manager
            .ensure_directories()
            .with_context(|| "Failed to ensure secured directory exists")?;

        Ok(Self {
            config_file_path,
            write_lock: Arc::new(Mutex::new(())),
        })
    }

    pub async fn save_registration_data(
        &self,
        machine_id: String,
        client_id: String,
        client_secret: String,
    ) -> Result<()> {
        let _guard = self.write_lock.lock().await;
        let mut config = self.get()?;
        config.machine_id = machine_id;
        config.client_id = client_id;
        config.client_secret = client_secret;

        self.save(&config).await?;

        Ok(())
    }

    pub async fn replace_registration(
        &self,
        machine_id: String,
        client_id: String,
        client_secret: String,
    ) -> Result<()> {
        let _guard = self.write_lock.lock().await;
        let mut config = self.get()?;
        config.machine_id = machine_id;
        config.client_id = client_id;
        config.client_secret = client_secret;
        config.access_token = String::new();
        config.refresh_token = String::new();

        self.save(&config).await?;

        Ok(())
    }

    pub async fn update_tokens(&self, access_token: String, refresh_token: String) -> Result<()> {
        let _guard = self.write_lock.lock().await;
        let mut config = self.get()?;
        config.access_token = access_token;
        config.refresh_token = refresh_token;

        self.save(&config).await?;

        Ok(())
    }

    pub fn get_machine_id(&self) -> Result<String> {
        let config = self.get()?;
        Ok(config.machine_id.clone())
    }

    pub fn get_registration_credentials(&self) -> Result<(String, String)> {
        let config = self.get()?;
        Ok((config.machine_id, config.client_secret))
    }

    pub async fn get_client_credentials(&self) -> Result<(String, String)> {
        let config = self.get()?;
        Ok((config.client_id.clone(), config.client_secret.clone()))
    }

    pub async fn get_access_token(&self) -> Result<String> {
        let config = self.get()?;
        Ok(config.access_token.clone())
    }

    pub async fn get_refresh_token(&self) -> Result<String> {
        let config = self.get()?;
        Ok(config.refresh_token.clone())
    }

    /// Replaces a config that doesn't parse, copied first to `agent_config.json.corrupt`: rebuilt from `saved` with empty tokens, or emptied so the device registers again.
    pub async fn replace_corrupt(&self, saved: Option<&PersistedMachineInfo>) -> Result<()> {
        let _guard = self.write_lock.lock().await;
        let corrupt = match self.get() {
            Ok(_) => return Ok(()),
            Err(e) if e.is::<CorruptJson>() => e,
            Err(e) => return Err(e),
        };

        let copy = quarantine_path(&self.config_file_path);
        if let Err(e) = std::fs::copy(&self.config_file_path, &copy) {
            warn!(
                "Failed to copy the corrupt agent configuration to {}: {}",
                copy.display(),
                e
            );
        }

        match saved {
            Some(saved) => {
                self.save(&AgentConfiguration {
                    machine_id: saved.machine_id.clone(),
                    // The backend builds the client id from this template at registration.
                    client_id: format!("agent_{}", saved.machine_id),
                    client_secret: saved.client_secret.clone(),
                    ..AgentConfiguration::default()
                })
                .await?;
                warn!(
                    machine_id = %saved.machine_id,
                    "{:#}; rebuilt it from the saved machine record",
                    corrupt
                );
            }
            None => {
                self.save(&AgentConfiguration::default()).await?;
                error!(
                    "{:#}; no saved machine record to rebuild it from, so the device must register again: run `openframe-client auth` with the install command's arguments",
                    corrupt
                );
            }
        }
        Ok(())
    }

    fn get(&self) -> Result<AgentConfiguration> {
        Ok(read_json(&self.config_file_path)?.unwrap_or_default())
    }

    async fn save(&self, config: &AgentConfiguration) -> Result<()> {
        let json_content = serde_json::to_string_pretty(config)
            .context("Failed to serialize agent configuration to JSON")?;

        atomic_write(&self.config_file_path, json_content)
            .with_context(|| format!("Failed to write config file: {:?}", self.config_file_path))?;

        Ok(())
    }
}

#[cfg(test)]
#[path = "agent_configuration_service_tests.rs"]
mod tests;
