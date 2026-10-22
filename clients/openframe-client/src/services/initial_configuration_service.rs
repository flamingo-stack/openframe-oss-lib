use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::models::{DeviceTag, InitialConfiguration};
use crate::platform::directories::DirectoryManager;

#[derive(Clone)]
pub struct InitialConfigurationService {
    config_file_path: PathBuf,
    // Serializes the read-modify-write updates so two of them can't lose each other's fields.
    write_lock: Arc<Mutex<()>>,
}

impl InitialConfigurationService {
    pub fn new(directory_manager: DirectoryManager) -> Result<Self> {
        let config_file_path = directory_manager.secured_dir().join("initial_config.json");

        directory_manager
            .ensure_directories()
            .with_context(|| "Failed to ensure secured directory exists")?;

        Ok(Self {
            config_file_path,
            write_lock: Arc::new(Mutex::new(())),
        })
    }

    pub fn get_initial_key(&self) -> Result<String> {
        let config = self.get()?;
        Ok(config.initial_key.clone())
    }

    pub fn get_log_key(&self) -> Result<String> {
        let config = self.get()?;
        Ok(config.log_key)
    }

    pub fn save_log_key(&self, log_key: String) -> Result<()> {
        let _guard = self.write_lock.lock().unwrap_or_else(|e| e.into_inner());
        let mut config = self.get()?;
        config.log_key = log_key;
        self.save(&config)
            .context("Failed to save initial configuration with the log key")
    }

    pub fn get_server_url(&self) -> Result<String> {
        let config = self.get()?;
        Ok(config.server_host.clone())
    }

    pub fn is_local_mode(&self) -> Result<bool> {
        let config = self.get()?;
        Ok(config.local_mode)
    }

    pub fn get_org_id(&self) -> Result<String> {
        let config = self.get()?;
        Ok(config.org_id.clone())
    }

    pub fn get_user_id(&self) -> Result<String> {
        let config = self.get()?;
        Ok(config.user_id.clone())
    }

    pub fn get_local_ca_cert_path(&self) -> Result<String> {
        let config = self.get()?;
        Ok(config.local_ca_cert_path.clone())
    }

    pub fn get_tags(&self) -> Result<Vec<DeviceTag>> {
        let config = self.get()?;
        Ok(config.tags)
    }

    pub fn get_remote_access_mode(&self) -> Result<Option<String>> {
        let config = self.get()?;
        Ok(config.remote_access_mode)
    }

    pub fn clear_remote_access_mode(&self) -> Result<()> {
        let _guard = self.write_lock.lock().unwrap_or_else(|e| e.into_inner());
        let mut config = self.get()?;
        config.remote_access_mode = None;
        self.save(&config)
            .context("Failed to save initial configuration without the remote access mode")
    }

    /// True once a usable configuration exists on disk — the awaiting-auth gate's
    /// release condition. Requires a parseable file with a non-empty server host
    /// so a partially written file cannot release the gate.
    pub fn is_configured(&self) -> bool {
        self.get()
            .map(|config| !config.server_host.trim().is_empty())
            .unwrap_or(false)
    }

    fn get(&self) -> Result<InitialConfiguration> {
        if !self.config_file_path.exists() {
            return Err(anyhow::anyhow!("Initial configuration file does not exist"));
        }

        let json_content = fs::read_to_string(&self.config_file_path).with_context(|| {
            format!(
                "Failed to read initial config file: {:?}",
                self.config_file_path
            )
        })?;

        let config: InitialConfiguration = serde_json::from_str(&json_content)
            .context("Failed to deserialize initial configuration from JSON")?;

        Ok(config)
    }

    pub fn clear_initial_key(&self) -> Result<()> {
        let _guard = self.write_lock.lock().unwrap_or_else(|e| e.into_inner());
        let mut config = self.get()?;
        if config.initial_key.is_empty() {
            return Ok(());
        }
        config.initial_key = String::new();
        self.save(&config)
            .context("Failed to save initial configuration to file")?;
        Ok(())
    }

    pub fn save(&self, config: &InitialConfiguration) -> Result<()> {
        let config_json = serde_json::to_string_pretty(config)
            .context("Failed to serialize initial configuration to JSON")?;
        crate::utils::fs::atomic_write(&self.config_file_path, config_json).with_context(|| {
            format!(
                "Failed to write initial configuration file: {:?}",
                self.config_file_path
            )
        })?;
        Ok(())
    }
}

#[cfg(test)]
#[path = "initial_configuration_service_tests.rs"]
mod tests;
