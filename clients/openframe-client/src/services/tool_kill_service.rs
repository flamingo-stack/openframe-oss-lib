use crate::config::service_stop::{
    FORCE_KILL_TIMEOUT_SECS, GRACEFUL_SHUTDOWN_TIMEOUT_SECS, MAX_KILL_RETRIES,
    PROCESS_CHECK_INTERVAL_MS,
};
use crate::models::{Installation, InstalledTool};
use crate::platform::binary_writer::aside_path;
use crate::platform::orphan_reaper::normalize_exe;
use crate::platform::{process_kill, system_service, DirectoryManager};
use anyhow::Result;
use std::path::{Path, PathBuf};
use sysinfo::{Pid, ProcessRefreshKind, System, UpdateKind};
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};

/// Service responsible for stopping/killing tool processes
#[derive(Clone)]
pub struct ToolKillService;

impl Default for ToolKillService {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolKillService {
    pub fn new() -> Self {
        Self
    }

    /// Stop the processes running the tool's agent binary, retrying the kill until they exit.
    pub async fn stop_tool(&self, tool_id: &str) -> Result<()> {
        let target = Self::relative_agent_path(tool_id);
        self.stop_processes_running_from(target, &format!("tool: {}", tool_id))
            .await
    }

    /// Stop the processes running the tool's asset binary, retrying the kill until they exit.
    pub async fn stop_asset(&self, asset_id: &str, tool_id: &str) -> Result<()> {
        let target = Self::relative_asset_path(asset_id, tool_id);
        self.stop_processes_running_from(
            target,
            &format!("asset: {} (tool: {})", asset_id, tool_id),
        )
        .await
    }

    /// Collect (pid, image) of processes other than this one that run from any of the targets.
    fn collect_matching_processes(targets: &[PathBuf]) -> Vec<(Pid, String)> {
        let targets: Vec<PathBuf> = targets
            .iter()
            .flat_map(|target| [normalize(target), normalize(&resolve_symlinks(target))])
            .collect();
        let own_pid = Pid::from_u32(std::process::id());
        let mut sys = System::new();
        sys.refresh_processes_specifics(
            ProcessRefreshKind::new()
                .with_cmd(UpdateKind::Always)
                .with_exe(UpdateKind::Always),
        );
        sys.processes()
            .iter()
            .filter(|(pid, _)| **pid != own_pid)
            .filter_map(|(pid, process)| {
                let image =
                    process_image(process.exe(), process.cmd().first().map(String::as_str))?;
                targets
                    .iter()
                    .any(|target| runs_from(&image, target))
                    .then(|| (*pid, image.display().to_string()))
            })
            .collect()
    }

    /// Check whether the installed tool's process is running; the target set mirrors stop_for_installation's kill targets.
    pub async fn is_installed_tool_running(&self, tool: &InstalledTool) -> bool {
        let mut targets: Vec<PathBuf> = Vec::new();
        match &tool.installation {
            Installation::GuiApp {
                executable_path, ..
            } => targets.push(PathBuf::from(executable_path)),
            Installation::Standard { executable_path } => {
                if let Some(path) = executable_path {
                    targets.push(PathBuf::from(path));
                }
                targets.push(Self::relative_agent_path(&tool.tool_agent_id));
            }
            Installation::Service {
                executable_path, ..
            } => match executable_path {
                Some(path) => targets.push(PathBuf::from(path)),
                // No registered path to mirror: fall back to the agent path rather than reporting a blind false.
                None => targets.push(Self::relative_agent_path(&tool.tool_agent_id)),
            },
        }
        tokio::task::spawn_blocking(move || !Self::collect_matching_processes(&targets).is_empty())
            .await
            .unwrap_or(false)
    }

    /// Stop every process running from `target` (see [`runs_from`]), with retries and verification.
    async fn stop_processes_running_from(&self, target: PathBuf, description: &str) -> Result<()> {
        info!("Attempting to stop {}", description);
        info!("Stopping processes running from: {}", target.display());

        let matches =
            tokio::task::spawn_blocking(move || Self::collect_matching_processes(&[target]))
                .await
                .unwrap_or_default();

        let mut pids_to_stop = Vec::new();
        for (pid, exe_path) in matches {
            info!(
                "Found process for {} with pid {} (exe: {})",
                description, pid, exe_path
            );
            pids_to_stop.push(pid);
        }

        if pids_to_stop.is_empty() {
            info!("No running processes found for {}", description);
            return Ok(());
        }

        info!(
            "Found {} process(es) to stop for {}",
            pids_to_stop.len(),
            description
        );

        // Stop each process with retries
        for pid in pids_to_stop {
            self.stop_process_with_retry(pid, description).await?;
        }

        info!("All processes stopped successfully for {}", description);
        Ok(())
    }

    /// Stop a single process with retry logic and verification
    ///
    /// Kills the process and waits for it to exit, then retries the kill while it is still running.
    async fn stop_process_with_retry(&self, pid: Pid, description: &str) -> Result<()> {
        info!("Stopping process {} for {}", pid, description);

        if self.try_first_kill(pid, description).await? {
            return Ok(());
        }

        for attempt in 1..=MAX_KILL_RETRIES {
            info!(
                "Force kill attempt {}/{} for process {} ({})",
                attempt, MAX_KILL_RETRIES, pid, description
            );

            if self.try_force_kill(pid, description).await? {
                return Ok(());
            }

            if attempt < MAX_KILL_RETRIES {
                warn!(
                    "Force kill attempt {} failed for process {} ({}), retrying...",
                    attempt, pid, description
                );
                sleep(Duration::from_secs(1)).await;
            }
        }

        error!(
            "Failed to stop process {} ({}) after {} attempts",
            pid, description, MAX_KILL_RETRIES
        );
        Err(anyhow::anyhow!(
            "Failed to stop process {} ({}) after {} attempts",
            pid,
            description,
            MAX_KILL_RETRIES
        ))
    }

    /// Stops one process: a kill, then kill retries, each waited for.
    pub async fn stop_process(&self, pid: u32, description: &str) -> Result<()> {
        self.stop_process_with_retry(Pid::from_u32(pid), description)
            .await
    }

    /// Kill the process and wait for it to exit
    async fn try_first_kill(&self, pid: Pid, description: &str) -> Result<bool> {
        let mut sys = System::new_all();
        sys.refresh_all();

        if sys.process(pid).is_some() {
            info!("Killing process {} ({})", pid, description);

            if let Err(e) = process_kill::terminate(pid.as_u32()) {
                warn!("Failed to kill process {} ({}): {}", pid, description, e);
                return Ok(false);
            }

            // Wait for process to exit
            if self
                .wait_for_process_exit(pid, GRACEFUL_SHUTDOWN_TIMEOUT_SECS)
                .await
            {
                info!("Process {} ({}) exited after the kill", pid, description);
                return Ok(true);
            }

            warn!(
                "Process {} ({}) did not exit within {} seconds after the kill",
                pid, description, GRACEFUL_SHUTDOWN_TIMEOUT_SECS
            );
        }

        Ok(false)
    }

    /// Try force kill and wait for process to exit
    async fn try_force_kill(&self, pid: Pid, description: &str) -> Result<bool> {
        let mut sys = System::new_all();
        sys.refresh_all();

        if sys.process(pid).is_some() {
            info!(
                "Sending force kill signal to process {} ({})",
                pid, description
            );

            match process_kill::terminate(pid.as_u32()) {
                Ok(()) => {
                    info!(
                        "Force kill signal sent to process {} ({})",
                        pid, description
                    );
                }
                Err(e) => {
                    warn!(
                        "Force kill signal failed for process {} ({}): {}",
                        pid, description, e
                    );
                    return Ok(false);
                }
            }

            // Wait for process to exit
            if self
                .wait_for_process_exit(pid, FORCE_KILL_TIMEOUT_SECS)
                .await
            {
                info!("Process {} ({}) terminated by force kill", pid, description);
                return Ok(true);
            }

            warn!(
                "Process {} ({}) still running after force kill signal",
                pid, description
            );
            Ok(false)
        } else {
            // Process not found - it might have already exited
            info!(
                "Process {} ({}) not found, likely already exited",
                pid, description
            );
            Ok(true)
        }
    }

    /// Wait for a process to exit, checking periodically
    ///
    /// Returns true if process exited, false if timeout reached
    async fn wait_for_process_exit(&self, pid: Pid, timeout_secs: u64) -> bool {
        let max_checks = (timeout_secs * 1000) / PROCESS_CHECK_INTERVAL_MS;

        for check in 1..=max_checks {
            sleep(Duration::from_millis(PROCESS_CHECK_INTERVAL_MS)).await;

            let mut sys = System::new_all();
            sys.refresh_all();

            if sys.process(pid).is_none() {
                info!(
                    "Process {} exited after {} ms",
                    pid,
                    check * PROCESS_CHECK_INTERVAL_MS
                );
                return true;
            }
        }

        false
    }

    pub async fn stop_tool_by_path(&self, executable_path: &str) -> Result<()> {
        self.stop_processes_running_from(
            PathBuf::from(executable_path),
            &format!("path: {}", executable_path),
        )
        .await
    }

    pub async fn stop_installed_tool(
        &self,
        tool: &InstalledTool,
        allow_delete: bool,
    ) -> Result<()> {
        self.stop_for_installation(&tool.tool_agent_id, &tool.installation, allow_delete)
            .await
    }

    pub async fn stop_for_installation(
        &self,
        tool_agent_id: &str,
        installation: &Installation,
        allow_delete: bool,
    ) -> Result<()> {
        match installation {
            Installation::GuiApp {
                executable_path, ..
            } => {
                info!("Stopping GUI app by executable path: {}", executable_path);
                self.stop_tool_by_path(executable_path).await
            }
            Installation::Standard { executable_path } => {
                if let Some(path) = executable_path {
                    self.stop_tool_by_path(path).await?;
                }
                self.stop_tool(tool_agent_id).await
            }
            Installation::Service {
                service_name,
                executable_path,
            } => {
                info!(service_name = %service_name,
                      "Stopping Service type tool via system service manager");
                if let Err(e) = system_service::stop_service(service_name, allow_delete).await {
                    warn!(
                        "Failed to stop service {} (continuing with process kill by path): {:#}",
                        service_name, e
                    );
                }

                // Kill any remaining processes by executable path (detached children)
                if let Some(path) = executable_path {
                    info!("Killing remaining processes by path: {}", path);
                    self.stop_tool_by_path(path).await?;
                }
                Ok(())
            }
        }
    }

    /// The tool's agent binary relative to the tools folder: `{tool}/agent`, `{tool}\agent.exe` on Windows.
    fn relative_agent_path(tool_id: &str) -> PathBuf {
        Path::new(tool_id).join(DirectoryManager::agent_file_name())
    }

    /// The tool's asset binary relative to the tools folder: `{tool}/{asset}`, `{tool}\{asset}.exe` on Windows.
    fn relative_asset_path(asset_id: &str, tool_id: &str) -> PathBuf {
        Path::new(tool_id).join(DirectoryManager::executable_file_name(asset_id))
    }
}

/// The process's executable, or its argv[0] when the executable can't be read.
fn process_image(exe: Option<&Path>, argv0: Option<&str>) -> Option<PathBuf> {
    exe.map(Path::to_path_buf)
        .or_else(|| argv0.map(PathBuf::from))
        .map(|image| normalize(&image))
}

fn normalize(path: &Path) -> PathBuf {
    PathBuf::from(normalize_exe(&path.to_string_lossy(), true))
}

fn resolve_symlinks(target: &Path) -> PathBuf {
    if target.is_absolute() {
        std::fs::canonicalize(target).unwrap_or_else(|_| target.to_path_buf())
    } else {
        target.to_path_buf()
    }
}

/// The image is the target or its aside copy, or lies under an absolute target; a relative target matches its last components.
fn runs_from(image: &Path, target: &Path) -> bool {
    [target.to_path_buf(), aside_path(target)]
        .iter()
        .any(|target| {
            if target.is_absolute() {
                image.starts_with(target)
            } else {
                image.ends_with(target)
            }
        })
}

#[cfg(test)]
#[path = "tool_kill_service_tests.rs"]
mod tests;
