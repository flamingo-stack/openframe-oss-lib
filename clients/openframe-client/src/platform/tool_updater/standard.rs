use anyhow::{Context, Result};
use async_trait::async_trait;
use bytes::Bytes;
use tracing::info;

use super::{
    backup_binary, cleanup_backup, clear_aside_binary, log_update_survivors, restore_from_backup,
    ToolUpdater, ToolUpdaterDeps, UpdateContext,
};
use crate::models::{DownloadConfiguration, Installation, InstalledTool};
use crate::platform::binary_writer;

pub struct StandardToolUpdater {
    deps: ToolUpdaterDeps,
}

impl StandardToolUpdater {
    pub fn new(deps: ToolUpdaterDeps) -> Self {
        Self { deps }
    }
}

#[async_trait]
impl ToolUpdater for StandardToolUpdater {
    async fn fetch(&self, _tool: &InstalledTool, config: &DownloadConfiguration) -> Result<Bytes> {
        self.deps
            .github_download_service
            .download_and_extract(config)
            .await
    }

    async fn prepare(&self, tool: &InstalledTool) -> Result<UpdateContext> {
        let tool_agent_id = &tool.tool_agent_id;
        info!(tool_id = %tool_agent_id, "Preparing Standard tool for update");

        info!(tool_id = %tool_agent_id, "Stopping tool process");
        self.deps
            .tool_kill_service
            .stop_tool(tool_agent_id)
            .await
            .with_context(|| format!("Failed to stop tool: {}", tool_agent_id))?;

        let agent_path = self
            .deps
            .directory_manager
            .get_tool_executable_path(&tool.tool_agent_id, tool.installation.executable_path());
        clear_aside_binary(&agent_path, tool_agent_id).await;
        log_update_survivors(&self.deps, tool).await;

        let backup_path = backup_binary(&agent_path, tool_agent_id).await?;

        Ok(UpdateContext {
            backup_path,
            needs_restart: true,
        })
    }

    async fn apply(
        &self,
        tool: &InstalledTool,
        _config: &DownloadConfiguration,
        fetched: Bytes,
    ) -> Result<Option<Installation>> {
        let tool_agent_id = &tool.tool_agent_id;
        info!(tool_id = %tool_agent_id, "Applying Standard tool update");

        let agent_path = self
            .deps
            .directory_manager
            .get_tool_executable_path(&tool.tool_agent_id, tool.installation.executable_path());
        binary_writer::write_executable(&fetched, &agent_path)
            .await
            .with_context(|| format!("Failed to write binary for: {}", tool_agent_id))?;
        Ok(None)
    }

    async fn finalize(&self, tool: &InstalledTool, ctx: &UpdateContext) -> Result<()> {
        let tool_agent_id = &tool.tool_agent_id;
        info!(tool_id = %tool_agent_id, "Finalizing Standard tool update");

        cleanup_backup(ctx.backup_path.as_ref(), tool_agent_id).await;

        if ctx.needs_restart {
            info!(tool_id = %tool_agent_id, "Tool will auto-restart via run manager");
        }

        Ok(())
    }

    async fn rollback(&self, tool: &InstalledTool, ctx: &UpdateContext) -> Result<()> {
        let tool_agent_id = &tool.tool_agent_id;
        info!(tool_id = %tool_agent_id, "Rolling back Standard tool update");

        let agent_path = self
            .deps
            .directory_manager
            .get_tool_executable_path(&tool.tool_agent_id, tool.installation.executable_path());
        restore_from_backup(ctx.backup_path.as_ref(), &agent_path, tool_agent_id).await
    }
}
