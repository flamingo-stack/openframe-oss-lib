use anyhow::{Context, Result};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::models::tool_connection::ToolConnection;
use crate::platform::directories::DirectoryManager;
use crate::utils::fs::{atomic_write, read_json_or_quarantine};

#[derive(Clone)]
pub struct ToolConnectionService {
    file_path: PathBuf,
    writer: Arc<Mutex<()>>,
}

impl ToolConnectionService {
    /// Creates new service storing data in secured directory file `tool_connections.json`
    pub fn new(directory_manager: DirectoryManager) -> Result<Self> {
        let path = directory_manager
            .secured_dir()
            .join("tool_connections.json");
        directory_manager
            .ensure_directories()
            .with_context(|| "Failed to ensure secured directory exists")?;
        Ok(Self {
            file_path: path,
            writer: Arc::new(Mutex::new(())),
        })
    }

    /// Save (upsert) connection
    pub async fn save(&self, connection: ToolConnection) -> Result<()> {
        let _guard = self.writer.lock().await;
        let mut list = self.get_all().await?;

        if let Some(existing) = list
            .iter_mut()
            .find(|c| c.tool_agent_id == connection.tool_agent_id)
        {
            *existing = connection;
        } else {
            list.push(connection);
        }

        self.persist(&list).await
    }

    pub async fn get_all(&self) -> Result<Vec<ToolConnection>> {
        let list = read_json_or_quarantine(&self.file_path).with_context(|| {
            format!("Failed to read tool connections file: {:?}", self.file_path)
        })?;
        Ok(list.parsed().unwrap_or_default())
    }

    /// Delete a tool connection by its tool_agent_id
    pub async fn delete_by_tool_agent_id(&self, tool_agent_id: &str) -> Result<bool> {
        let _guard = self.writer.lock().await;
        let mut list = self.get_all().await?;
        let initial_len = list.len();
        list.retain(|c| c.tool_agent_id != tool_agent_id);

        if list.len() != initial_len {
            self.persist(&list).await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn persist(&self, list: &[ToolConnection]) -> Result<()> {
        let json = serde_json::to_string_pretty(list)
            .context("Failed to serialize tool connections to JSON")?;
        atomic_write(&self.file_path, json).with_context(|| {
            format!(
                "Failed to write tool connections file: {:?}",
                self.file_path
            )
        })?;
        Ok(())
    }
}

#[cfg(test)]
#[path = "tool_connection_service_tests.rs"]
mod tests;
