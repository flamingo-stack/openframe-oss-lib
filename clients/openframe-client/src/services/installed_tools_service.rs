use crate::models::{InstalledTool, ToolRecordState};
use crate::platform::directories::DirectoryManager;
use crate::utils::fs::{atomic_write, read_json};
use anyhow::{Context, Result};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct InstalledToolsService {
    file_path: PathBuf,
    writer: Arc<Mutex<()>>,
}

impl InstalledToolsService {
    pub fn new(directory_manager: DirectoryManager) -> Result<Self> {
        let path = directory_manager.secured_dir().join("installed_tools.json");
        directory_manager
            .ensure_directories()
            .with_context(|| "Failed to ensure secured directory exists")?;
        Ok(Self {
            file_path: path,
            writer: Arc::new(Mutex::new(())),
        })
    }

    pub async fn save(&self, tool: InstalledTool) -> Result<()> {
        let _guard = self.writer.lock().await;
        let mut tools = self.get_all().await?;

        if let Some(existing) = tools
            .iter_mut()
            .find(|t| t.tool_agent_id == tool.tool_agent_id)
        {
            *existing = tool;
        } else {
            tools.push(tool);
        }

        self.persist(&tools).await
    }

    pub async fn set_state(&self, tool_agent_id: &str, state: ToolRecordState) -> Result<bool> {
        let _guard = self.writer.lock().await;
        let mut tools = self.get_all().await?;
        if let Some(existing) = tools.iter_mut().find(|t| t.tool_agent_id == tool_agent_id) {
            existing.state = state;
            self.persist(&tools).await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn get_by_tool_agent_id(&self, tool_id: &str) -> Result<Option<InstalledTool>> {
        let tools = self.get_all().await?;
        Ok(tools.into_iter().find(|t| t.tool_agent_id == tool_id))
    }

    pub async fn get_all(&self) -> Result<Vec<InstalledTool>> {
        Ok(read_json(&self.file_path)?.unwrap_or_default())
    }

    /// Delete an installed tool by its tool_agent_id
    pub async fn delete_by_tool_agent_id(&self, tool_agent_id: &str) -> Result<bool> {
        let _guard = self.writer.lock().await;
        let mut tools = self.get_all().await?;
        let initial_len = tools.len();
        tools.retain(|t| t.tool_agent_id != tool_agent_id);

        if tools.len() != initial_len {
            self.persist(&tools).await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn persist(&self, tools: &[InstalledTool]) -> Result<()> {
        let json = serde_json::to_string_pretty(tools)
            .context("Failed to serialize installed tools to JSON")?;

        atomic_write(&self.file_path, json)
            .with_context(|| format!("Failed to write tools file: {:?}", self.file_path))
    }
}

#[cfg(test)]
#[path = "installed_tools_service_tests.rs"]
mod tests;
