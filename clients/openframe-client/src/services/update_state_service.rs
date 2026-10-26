use crate::models::update_state::UpdateState;
use crate::platform::directories::DirectoryManager;
use crate::utils::fs::{atomic_write, read_json_text_or_quarantine};
use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;
use tracing::{debug, info};

#[derive(Clone)]
pub struct UpdateStateService {
    state_file_path: PathBuf,
}

impl UpdateStateService {
    pub fn new(directory_manager: DirectoryManager) -> Result<Self> {
        let state_file_path = directory_manager.secured_dir().join("update_state.json");

        directory_manager
            .ensure_directories()
            .with_context(|| "Failed to ensure secured directory exists")?;

        Ok(Self { state_file_path })
    }

    pub async fn load(&self) -> Result<Option<UpdateState>> {
        info!(
            "Checking for update state file at: {}",
            self.state_file_path.display()
        );

        let state: Option<(UpdateState, String)> =
            read_json_text_or_quarantine(&self.state_file_path).with_context(|| {
                format!(
                    "Failed to read update state file: {:?}",
                    self.state_file_path
                )
            })?;
        let Some((state, json_content)) = state else {
            info!(
                "No update state file found at: {}",
                self.state_file_path.display()
            );
            return Ok(None);
        };

        info!("Read update state file content: {}", json_content);

        info!(
            "Loaded update state for version: {}, phase: {:?}",
            state.target_version, state.phase
        );
        Ok(Some(state))
    }

    pub async fn save(&self, state: &UpdateState) -> Result<()> {
        let json_content = serde_json::to_string_pretty(state)
            .context("Failed to serialize update state to JSON")?;

        atomic_write(&self.state_file_path, json_content).with_context(|| {
            format!(
                "Failed to write update state file: {:?}",
                self.state_file_path
            )
        })?;

        debug!(
            "Saved update state for version: {}, phase: {:?}",
            state.target_version, state.phase
        );
        Ok(())
    }

    pub async fn clear(&self) -> Result<()> {
        if self.state_file_path.exists() {
            fs::remove_file(&self.state_file_path).with_context(|| {
                format!(
                    "Failed to remove update state file: {:?}",
                    self.state_file_path
                )
            })?;

            info!("Cleared update state");
        }
        Ok(())
    }

    pub async fn has_incomplete_update(&self) -> Result<bool> {
        match self.load().await? {
            Some(_state) => Ok(true), // If state exists, recovery is needed
            None => Ok(false),
        }
    }

    pub fn get_state_file_path(&self) -> String {
        self.state_file_path.to_string_lossy().to_string()
    }
}

#[cfg(test)]
#[path = "update_state_service_tests.rs"]
mod tests;
