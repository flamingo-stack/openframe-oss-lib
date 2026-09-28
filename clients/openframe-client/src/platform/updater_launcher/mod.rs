use std::path::PathBuf;
use std::process::ExitStatus;
use tokio::task::JoinHandle;

/// Parameters needed to launch the updater
pub struct UpdaterParams {
    pub binary_path: PathBuf,
    pub target_exe: PathBuf,
    pub service_name: String,
    pub update_state_path: String,
    pub target_version: String,
    pub boot_marker_path: PathBuf,
    pub lkg_path: PathBuf,
    pub transcript_path: PathBuf,
    pub rollback_only: bool,
}

/// Handle to a launched updater
pub struct LaunchedUpdater {
    /// Exit status if the updater exits while this process is alive (None: the wait failed); absent where it cannot be watched.
    pub exit_watch: Option<JoinHandle<Option<ExitStatus>>>,
}

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::launch_updater;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::launch_updater;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::launch_updater;
