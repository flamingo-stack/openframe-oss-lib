use anyhow::{Context, Result};
use async_trait::async_trait;
use tracing::info;

use super::{
    backup_binary, cleanup_backup, clear_aside_binary, download_and_write_binary,
    log_update_survivors, restore_from_backup, ToolUpdater, ToolUpdaterDeps, UpdateContext,
};
use crate::models::{DownloadConfiguration, Installation, InstalledTool};

pub struct StandardToolUpdater {
    deps: ToolUpdaterDeps,
}

impl StandardToolUpdater {
    pub fn new(deps: ToolUpdaterDeps) -> Self {
        Self { deps }
    }

    /// Honour the executable path the installer recorded. A folder-extraction config
    /// installs to e.g. `<tool>/bin/tool`, not `<tool>/agent` — writing to the latter
    /// regardless left the tool running its old binary while the record, and the backend,
    /// reported the new version. `ServiceToolUpdater::resolve_executable_path` already
    /// does this; Standard was the outlier.
    fn resolve_executable_path(&self, tool: &InstalledTool) -> std::path::PathBuf {
        let agent_path = self
            .deps
            .directory_manager
            .get_agent_path(&tool.tool_agent_id);

        if let Installation::Standard {
            executable_path: Some(exec_path),
        } = &tool.installation
        {
            if exec_path.starts_with('/') || exec_path.contains(':') {
                std::path::PathBuf::from(exec_path)
            } else {
                agent_path.parent().unwrap_or(&agent_path).join(exec_path)
            }
        } else {
            agent_path
        }
    }
}

#[async_trait]
impl ToolUpdater for StandardToolUpdater {
    async fn prepare(&self, tool: &InstalledTool) -> Result<UpdateContext> {
        let tool_agent_id = &tool.tool_agent_id;
        info!(tool_id = %tool_agent_id, "Preparing Standard tool for update");

        info!(tool_id = %tool_agent_id, "Stopping tool process");
        self.deps
            .tool_kill_service
            .stop_tool(tool_agent_id)
            .await
            .with_context(|| format!("Failed to stop tool: {}", tool_agent_id))?;

        let agent_path = self.resolve_executable_path(tool);
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
        config: &DownloadConfiguration,
        _ctx: &UpdateContext,
    ) -> Result<Option<Installation>> {
        let tool_agent_id = &tool.tool_agent_id;
        info!(tool_id = %tool_agent_id, "Applying Standard tool update");

        let agent_path = self.resolve_executable_path(tool);
        download_and_write_binary(&self.deps, config, &agent_path, tool_agent_id).await?;
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

        let agent_path = self.resolve_executable_path(tool);
        restore_from_backup(ctx.backup_path.as_ref(), &agent_path, tool_agent_id).await
    }
}
