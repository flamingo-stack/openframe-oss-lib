use anyhow::{Context, Result};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use tracing::{error, info, warn};

use super::{ToolUpdater, ToolUpdaterDeps, UpdateContext};
use crate::models::{DownloadConfiguration, Installation, InstalledTool};
use crate::platform::preferences_writer::{args_to_pairs, write as write_preferences};
use crate::platform::user_session::{get_console_user, launch_as_user};
use crate::platform::DirectoryManager;

pub struct GuiAppToolUpdater {
    deps: ToolUpdaterDeps,
}

impl GuiAppToolUpdater {
    pub fn new(deps: ToolUpdaterDeps) -> Self {
        Self { deps }
    }

    fn backup_path_for(bundle: &Path) -> PathBuf {
        let name = bundle
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "bundle".to_string());
        bundle.with_file_name(format!(".{name}.update-backup"))
    }

    async fn move_bundle_aside(
        executable_path: &str,
        tool_agent_id: &str,
    ) -> Result<Option<PathBuf>> {
        let Some(bundle) = DirectoryManager::find_app_bundle_path(Path::new(executable_path))
        else {
            warn!(tool_id = %tool_agent_id, "No .app bundle in {} — updating without a backup", executable_path);
            return Ok(None);
        };
        let backup = Self::backup_path_for(&bundle);

        if !bundle.exists() {
            if backup.exists() {
                info!(tool_id = %tool_agent_id, "Adopting the backup left by an interrupted update");
                return Ok(Some(backup));
            }
            return Ok(None);
        }
        if backup.exists() {
            tokio::fs::remove_dir_all(&backup).await.ok();
        }
        tokio::fs::rename(&bundle, &backup).await.with_context(|| {
            format!(
                "Failed to move {} aside to {}",
                bundle.display(),
                backup.display()
            )
        })?;
        info!(tool_id = %tool_agent_id, "Old app bundle kept at {}", backup.display());
        Ok(Some(backup))
    }
}

#[async_trait]
impl ToolUpdater for GuiAppToolUpdater {
    async fn prepare(&self, tool: &InstalledTool) -> Result<UpdateContext> {
        let tool_agent_id = &tool.tool_agent_id;
        info!(tool_id = %tool_agent_id, "Preparing GuiApp for update");

        info!(tool_id = %tool_agent_id, "Stopping GUI app process");
        self.deps
            .tool_kill_service
            .stop_installed_tool(tool, false)
            .await
            .with_context(|| format!("Failed to stop GUI app: {}", tool_agent_id))?;

        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        let backup_path = match &tool.installation {
            Installation::GuiApp {
                executable_path, ..
            } => Self::move_bundle_aside(executable_path, tool_agent_id).await?,
            _ => None,
        };

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
        info!(tool_id = %tool_agent_id, "Applying GuiApp update");

        let Installation::GuiApp { bundle_id, .. } = &tool.installation else {
            anyhow::bail!(
                "Expected GuiApp installation type for tool: {}",
                tool_agent_id
            );
        };

        let applications_dir = PathBuf::from("/Applications");

        info!(tool_id = %tool_agent_id, "Downloading and installing new version from: {}", config.link);
        self.deps
            .github_download_service
            .download_and_extract_all(config, &applications_dir)
            .await
            .with_context(|| {
                format!("Failed to download and install GUI app: {}", tool_agent_id)
            })?;

        let new_app_path = applications_dir.join(&config.target_file_name);
        if !new_app_path.exists() {
            anyhow::bail!(
                "New app bundle not found at expected path: {}",
                new_app_path.display()
            );
        }

        info!(tool_id = %tool_agent_id, "GuiApp updated successfully: {}", new_app_path.display());
        Ok(Some(Installation::GuiApp {
            executable_path: new_app_path.to_string_lossy().to_string(),
            bundle_id: bundle_id.clone(),
        }))
    }

    async fn finalize(&self, tool: &InstalledTool, ctx: &UpdateContext) -> Result<()> {
        let tool_agent_id = &tool.tool_agent_id;
        info!(tool_id = %tool_agent_id, "Finalizing GuiApp update");

        if let Some(backup) = &ctx.backup_path {
            if backup.exists() {
                if let Err(e) = tokio::fs::remove_dir_all(backup).await {
                    warn!(tool_id = %tool_agent_id, "Failed to remove the old app bundle {}: {:#}", backup.display(), e);
                }
            }
        }

        if !ctx.needs_restart {
            info!(tool_id = %tool_agent_id, "Restart not requested, skipping");
            return Ok(());
        }

        let Installation::GuiApp {
            executable_path,
            bundle_id,
        } = &tool.installation
        else {
            anyhow::bail!("Expected GuiApp installation type");
        };

        let user = loop {
            if let Some(u) = get_console_user() {
                break u;
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        };

        if let Some(bid) = bundle_id {
            // Resolve placeholders (e.g., ${client.serverUrl}) before writing preferences
            let resolved_args = self
                .deps
                .command_params_resolver
                .process(tool_agent_id, tool.run_command_args.clone())
                .unwrap_or_else(|e| {
                    warn!(tool_id = %tool_agent_id, "Failed to resolve command args: {:#}", e);
                    tool.run_command_args.clone()
                });

            let prefs = args_to_pairs(&resolved_args);
            if let Err(e) = write_preferences(bid, prefs) {
                warn!(tool_id = %tool_agent_id, "Failed to write preferences: {:#}", e);
            }
        }

        info!(tool_id = %tool_agent_id, "Launching updated GUI app as user: {}", user.username);
        let launch_args = if bundle_id.is_some() {
            // Args passed via preferences, but openframe-chat needs --background flag
            if tool_agent_id == "openframe-chat" {
                vec!["--background".to_string()]
            } else {
                vec![]
            }
        } else {
            tool.run_command_args.clone()
        };

        match launch_as_user(executable_path, &launch_args, &user).await {
            Ok(child) => {
                info!(tool_id = %tool_agent_id, "GUI app launched, PID: {:?}", child.id());
            }
            Err(e) => {
                error!(tool_id = %tool_agent_id, "Failed to launch GUI app: {:#}", e);
            }
        }

        Ok(())
    }

    async fn rollback(&self, tool: &InstalledTool, ctx: &UpdateContext) -> Result<()> {
        let tool_agent_id = &tool.tool_agent_id;

        let Some(backup) = &ctx.backup_path else {
            warn!(tool_id = %tool_agent_id,
                  "Rollback requested for GuiApp but no backup was taken. User should reinstall from server.");
            return Ok(());
        };

        let Installation::GuiApp {
            executable_path, ..
        } = &tool.installation
        else {
            anyhow::bail!("Expected GuiApp installation type for tool: {tool_agent_id}");
        };
        let Some(bundle) = DirectoryManager::find_app_bundle_path(Path::new(executable_path))
        else {
            anyhow::bail!("Could not resolve the .app bundle path for {tool_agent_id}");
        };

        if bundle.exists() {
            tokio::fs::remove_dir_all(&bundle).await.ok();
        }
        tokio::fs::rename(backup, &bundle).await.with_context(|| {
            format!(
                "Failed to restore the previous app bundle from {}",
                backup.display()
            )
        })?;

        info!(tool_id = %tool_agent_id, "Restored the previous app bundle: {}", bundle.display());
        Ok(())
    }
}

#[cfg(test)]
#[path = "gui_app_tests.rs"]
mod tests;
