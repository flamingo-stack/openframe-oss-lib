#[cfg(target_os = "macos")]
mod gui_app;
mod migration;
mod service;
mod standard;

#[cfg(target_os = "macos")]
pub use gui_app::GuiAppToolUpdater;
use migration::create_migrator;
pub use migration::needs_migration;
pub use service::ServiceToolUpdater;
pub use standard::StandardToolUpdater;

use anyhow::{Context, Result};
use async_trait::async_trait;
use bytes::Bytes;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tracing::{error, info, warn};

use crate::models::{DownloadConfiguration, Installation, InstallationType, InstalledTool};
#[cfg(target_os = "macos")]
use crate::platform::directories::APPLICATIONS_DIR;
use crate::platform::{binary_writer, DirectoryManager};
use crate::services::{GithubDownloadService, ToolCommandParamsResolver, ToolKillService};

/// The new version, downloaded before the running tool is stopped so a failed download leaves it untouched.
pub(crate) enum Staged {
    /// A single executable, kept in memory and written after the stop.
    Binary(Bytes),
    /// An extracted archive (`.app` bundle, `.dmg`), moved into place after the stop.
    #[cfg(target_os = "macos")]
    Tree(StagingDir),
}

impl Staged {
    /// Removes what the update did not move into place; in-memory bytes need nothing.
    #[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
    async fn discard(self, tool_agent_id: &str) {
        match self {
            Staged::Binary(_) => {}
            #[cfg(target_os = "macos")]
            Staged::Tree(staging) => staging.discard(tool_agent_id).await,
        }
    }
}

/// Staging folder beside the target, on the same volume, so moving it into place is a rename and not a copy.
#[cfg(target_os = "macos")]
pub(crate) struct StagingDir {
    root: PathBuf,
    target_dir: PathBuf,
}

#[cfg(target_os = "macos")]
impl StagingDir {
    fn new(target_dir: &Path, tool_agent_id: &str) -> Self {
        Self {
            root: target_dir.join(format!(".{tool_agent_id}.update-staging")),
            target_dir: target_dir.to_path_buf(),
        }
    }

    /// Renames each top-level entry into the target; an existing folder of the same name is replaced, not merged.
    pub(crate) async fn move_into(&self) -> Result<()> {
        let mut entries = fs::read_dir(&self.root)
            .await
            .with_context(|| format!("Failed to read {}", self.root.display()))?;
        while let Some(entry) = entries.next_entry().await? {
            let dest = self.target_dir.join(entry.file_name());
            match fs::symlink_metadata(&dest).await {
                Ok(meta) if meta.is_dir() => fs::remove_dir_all(&dest)
                    .await
                    .with_context(|| format!("Failed to remove {}", dest.display()))?,
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => {
                    return Err(e).with_context(|| format!("Failed to inspect {}", dest.display()))
                }
            }
            fs::rename(entry.path(), &dest).await.with_context(|| {
                format!(
                    "Failed to move {} to {}",
                    entry.path().display(),
                    dest.display()
                )
            })?;
        }
        fs::remove_dir(&self.root)
            .await
            .with_context(|| format!("Failed to remove {}", self.root.display()))
    }

    async fn discard(&self, tool_agent_id: &str) {
        match fs::remove_dir_all(&self.root).await {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => {
                warn!(tool_id = %tool_agent_id, "Failed to remove staging {}: {:#}", self.root.display(), e)
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct UpdateContext {
    pub backup_path: Option<PathBuf>,
    pub needs_restart: bool,
}

impl Default for UpdateContext {
    fn default() -> Self {
        Self {
            backup_path: None,
            needs_restart: true,
        }
    }
}

#[async_trait]
pub(crate) trait ToolUpdater: Send + Sync {
    /// Downloads the new version without touching the running tool.
    async fn fetch(&self, tool: &InstalledTool, config: &DownloadConfiguration) -> Result<Staged>;

    async fn prepare(&self, tool: &InstalledTool) -> Result<UpdateContext>;

    async fn apply(
        &self,
        tool: &InstalledTool,
        config: &DownloadConfiguration,
        staged: &Staged,
    ) -> Result<Option<Installation>>;

    async fn finalize(&self, tool: &InstalledTool, ctx: &UpdateContext) -> Result<()>;

    async fn rollback(&self, tool: &InstalledTool, ctx: &UpdateContext) -> Result<()>;
}

#[derive(Clone)]
pub struct ToolUpdaterDeps {
    pub github_download_service: GithubDownloadService,
    pub tool_kill_service: ToolKillService,
    pub directory_manager: DirectoryManager,
    pub command_params_resolver: ToolCommandParamsResolver,
}

fn create_updater(installation: &Installation, deps: ToolUpdaterDeps) -> Arc<dyn ToolUpdater> {
    match installation {
        Installation::Standard { .. } => Arc::new(StandardToolUpdater::new(deps)),
        Installation::GuiApp { .. } => {
            #[cfg(target_os = "macos")]
            {
                Arc::new(GuiAppToolUpdater::new(deps))
            }
            #[cfg(not(target_os = "macos"))]
            {
                // TODO: Implement proper Windows GuiApp updater
                // For now, use StandardToolUpdater which handles binary download/replace
                Arc::new(StandardToolUpdater::new(deps))
            }
        }
        Installation::Service { .. } => Arc::new(ServiceToolUpdater::new(deps)),
    }
}

pub async fn run_update(
    tool: &InstalledTool,
    config: &DownloadConfiguration,
    deps: ToolUpdaterDeps,
) -> Result<Option<Installation>> {
    let updater = create_updater(&tool.installation, deps);
    run_updater(updater.as_ref(), tool, config).await
}

/// fetch -> prepare (stop) -> apply -> finalize; the staging is removed on every exit after the fetch.
async fn run_updater(
    updater: &dyn ToolUpdater,
    tool: &InstalledTool,
    config: &DownloadConfiguration,
) -> Result<Option<Installation>> {
    let tool_id = &tool.tool_agent_id;

    info!(tool_id = %tool_id, "Phase 1: Downloading update");
    let staged = updater.fetch(tool, config).await.with_context(|| {
        format!(
            "Failed to download update for: {}, the running tool was not touched",
            tool_id
        )
    })?;

    let result: Result<Option<Installation>> = async {
        info!(tool_id = %tool_id, "Phase 2: Preparing update");
        let ctx = updater
            .prepare(tool)
            .await
            .with_context(|| format!("Failed to prepare update for: {}", tool_id))?;

        info!(tool_id = %tool_id, "Phase 3: Applying update");
        let new_installation = match updater.apply(tool, config, &staged).await {
            Ok(new_installation) => new_installation,
            Err(e) => {
                error!(tool_id = %tool_id, error = %e, "Update failed, rolling back");
                if let Err(rollback_err) = updater.rollback(tool, &ctx).await {
                    error!(tool_id = %tool_id, error = %rollback_err, "Rollback also failed");
                }
                return Err(e).with_context(|| format!("Update failed for: {}", tool_id));
            }
        };

        info!(tool_id = %tool_id, "Phase 4: Finalizing update");
        let finalize_tool = match &new_installation {
            Some(installation) => {
                let mut updated = tool.clone();
                updated.installation = installation.clone();
                updated
            }
            None => tool.clone(),
        };
        updater
            .finalize(&finalize_tool, &ctx)
            .await
            .with_context(|| format!("Failed to finalize update for: {}", tool_id))?;

        Ok(new_installation)
    }
    .await;

    staged.discard(tool_id).await;
    result
}

pub async fn run_migration(
    tool: &InstalledTool,
    config: &DownloadConfiguration,
    target_type: InstallationType,
    deps: ToolUpdaterDeps,
) -> Result<Installation> {
    let tool_id = &tool.tool_agent_id;

    let migrator = create_migrator(&tool.installation, target_type, deps)?.ok_or_else(|| {
        anyhow::anyhow!(
            "No migration needed: {:?} -> {:?}",
            tool.installation,
            target_type
        )
    })?;

    info!(tool_id = %tool_id, "Migration Phase 1: Downloading");
    let staged = migrator.fetch(tool, config).await.with_context(|| {
        format!(
            "Failed to download migration for: {}, the running tool was not touched",
            tool_id
        )
    })?;

    let result: Result<Installation> = async {
        info!(tool_id = %tool_id, "Migration Phase 2: Preparing");
        let ctx = migrator
            .prepare(tool)
            .await
            .with_context(|| format!("Failed to prepare migration for: {}", tool_id))?;

        info!(tool_id = %tool_id, "Migration Phase 3: Migrating");
        match migrator.migrate(tool, config, &staged, &ctx).await {
            Ok(new_installation) => {
                info!(tool_id = %tool_id, "Migration Phase 4: Finalizing");
                migrator
                    .finalize(tool, &new_installation, &ctx)
                    .await
                    .with_context(|| format!("Failed to finalize migration for: {}", tool_id))?;

                info!(tool_id = %tool_id, "Migration completed: {:?}", new_installation);
                Ok(new_installation)
            }
            Err(e) => {
                error!(tool_id = %tool_id, error = %e, "Migration failed, attempting rollback");
                if let Err(rollback_err) = migrator.rollback(tool, &ctx).await {
                    error!(tool_id = %tool_id, error = %rollback_err, "Rollback also failed");
                }
                Err(e).with_context(|| format!("Migration failed for: {}", tool_id))
            }
        }
    }
    .await;

    staged.discard(tool_id).await;
    result
}

/// Delete a leftover `.old` rename-aside; returns false when it is locked, i.e. a process from a previous update still executes it.
pub(crate) async fn clear_aside_binary(exec_path: &Path, tool_agent_id: &str) -> bool {
    let aside = binary_writer::aside_path(exec_path);
    if !aside.exists() {
        return true;
    }
    match fs::remove_file(&aside).await {
        Ok(()) => {
            info!(tool_id = %tool_agent_id, "Removed stale aside binary: {}", aside.display());
            true
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => true,
        Err(e) => {
            error!(tool_id = %tool_agent_id,
                   "Cannot remove {} — a process from a previous update is likely still running it: {e}",
                   aside.display());
            false
        }
    }
}

/// Post-kill visibility check: a surviving process keeps running the old version until it exits.
pub(crate) async fn log_update_survivors(deps: &ToolUpdaterDeps, tool: &InstalledTool) {
    if deps.tool_kill_service.is_installed_tool_running(tool).await {
        error!(tool_id = %tool.tool_agent_id,
               "Tool process still running after stop — update proceeds, but the running instance stays on the old version until it exits");
    }
}

pub(crate) async fn backup_binary(
    source_path: &Path,
    tool_agent_id: &str,
) -> Result<Option<PathBuf>> {
    if !source_path.exists() {
        info!(tool_id = %tool_agent_id, "No existing binary to backup at: {}", source_path.display());
        return Ok(None);
    }

    let backup_path = source_path.with_extension("backup");
    info!(tool_id = %tool_agent_id, "Backing up binary: {} -> {}",
          source_path.display(), backup_path.display());

    fs::copy(source_path, &backup_path)
        .await
        .with_context(|| format!("Failed to backup: {}", source_path.display()))?;

    Ok(Some(backup_path))
}

pub(crate) async fn fetch_binary(
    deps: &ToolUpdaterDeps,
    config: &DownloadConfiguration,
    tool_agent_id: &str,
) -> Result<Staged> {
    info!(tool_id = %tool_agent_id, "Downloading binary from: {}", config.link);
    let bytes = deps
        .github_download_service
        .download_and_extract(config)
        .await
        .with_context(|| format!("Failed to download: {}", tool_agent_id))?;
    Ok(Staged::Binary(bytes))
}

// Elsewhere `Staged` has only `Binary`, which clippy flags as an infallible match.
#[cfg_attr(
    not(target_os = "macos"),
    allow(clippy::infallible_destructuring_match)
)]
pub(crate) async fn write_binary(
    staged: &Staged,
    target_path: &Path,
    tool_agent_id: &str,
) -> Result<()> {
    let bytes = match staged {
        Staged::Binary(bytes) => bytes,
        #[cfg(target_os = "macos")]
        // Unreachable: only the updaters that stage a tree fetch one, and they never write a binary.
        Staged::Tree(_) => anyhow::bail!("Expected a downloaded binary for: {}", tool_agent_id),
    };
    info!(tool_id = %tool_agent_id, "Writing binary to: {}", target_path.display());
    binary_writer::write_executable(bytes, target_path)
        .await
        .with_context(|| format!("Failed to write binary for: {}", tool_agent_id))
}

/// Removes the app bundle staging a crashed update left in /Applications; uninstall calls it.
#[cfg(target_os = "macos")]
pub(crate) async fn remove_update_staging(tool_agent_id: &str) {
    StagingDir::new(Path::new(APPLICATIONS_DIR), tool_agent_id)
        .discard(tool_agent_id)
        .await;
}

/// Stages a GuiApp `.app` bundle beside /Applications.
#[cfg(target_os = "macos")]
pub(crate) async fn stage_app_bundle(
    deps: &ToolUpdaterDeps,
    config: &DownloadConfiguration,
    tool_agent_id: &str,
) -> Result<Staged> {
    stage_tree(deps, config, Path::new(APPLICATIONS_DIR), tool_agent_id).await
}

/// Extracts the archive into the staging beside `target_dir`; a leftover from a crashed update is removed first.
#[cfg(target_os = "macos")]
pub(crate) async fn stage_tree(
    deps: &ToolUpdaterDeps,
    config: &DownloadConfiguration,
    target_dir: &Path,
    tool_agent_id: &str,
) -> Result<Staged> {
    let staging = StagingDir::new(target_dir, tool_agent_id);
    staging.discard(tool_agent_id).await;
    fs::create_dir_all(&staging.root)
        .await
        .with_context(|| format!("Failed to create {}", staging.root.display()))?;

    info!(tool_id = %tool_agent_id, "Downloading {} into {}", config.link, staging.root.display());
    if let Err(e) = deps
        .github_download_service
        .download_and_extract_all(config, &staging.root)
        .await
    {
        staging.discard(tool_agent_id).await;
        return Err(e).with_context(|| format!("Failed to download: {}", tool_agent_id));
    }
    Ok(Staged::Tree(staging))
}

pub(crate) async fn cleanup_backup(backup_path: Option<&PathBuf>, tool_agent_id: &str) {
    let Some(path) = backup_path else { return };

    if !path.exists() {
        return;
    }

    info!(tool_id = %tool_agent_id, "Removing backup: {}", path.display());
    if let Err(e) = fs::remove_file(path).await {
        warn!(tool_id = %tool_agent_id, "Failed to remove backup: {:#}", e);
    }
}

pub(crate) async fn restore_from_backup(
    backup_path: Option<&PathBuf>,
    target_path: &Path,
    tool_agent_id: &str,
) -> Result<()> {
    let Some(backup) = backup_path else {
        warn!(tool_id = %tool_agent_id, "No backup available for rollback");
        return Ok(());
    };

    if !backup.exists() {
        warn!(tool_id = %tool_agent_id, "Backup file not found: {}", backup.display());
        return Ok(());
    }

    info!(tool_id = %tool_agent_id, "Restoring from backup: {} -> {}",
          backup.display(), target_path.display());

    fs::copy(backup, target_path)
        .await
        .with_context(|| "Failed to restore from backup")?;

    fs::remove_file(backup)
        .await
        .with_context(|| "Failed to remove backup after restore")?;

    info!(tool_id = %tool_agent_id, "Rollback completed");
    Ok(())
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
