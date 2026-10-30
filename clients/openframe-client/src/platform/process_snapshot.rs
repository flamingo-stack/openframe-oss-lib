use std::path::{Path, PathBuf};
use sysinfo::{ProcessRefreshKind, System, UpdateKind};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunningProcess {
    pub pid: u32,
    pub image: PathBuf,
    /// `None` when the parent has exited or its image is not readable.
    pub parent_image: Option<PathBuf>,
    /// Started by the service control manager; always false off Windows, where parents tell nothing.
    pub is_service: bool,
    /// The Windows session the process runs in; `None` off Windows or when it cannot be read.
    pub session: Option<u32>,
}

/// Every process with a readable image, in all sessions.
pub fn snapshot() -> Vec<RunningProcess> {
    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessRefreshKind::new().with_exe(UpdateKind::Always));
    let processes = sys.processes();
    processes
        .iter()
        .filter_map(|(pid, process)| {
            let image = process.exe()?.to_path_buf();
            let parent_image = process
                .parent()
                .and_then(|parent| processes.get(&parent))
                .and_then(|parent| parent.exe())
                .map(Path::to_path_buf);
            let is_service = cfg!(target_os = "windows")
                && parent_image
                    .as_deref()
                    .and_then(Path::file_name)
                    .is_some_and(|name| name.eq_ignore_ascii_case("services.exe"));
            Some(RunningProcess {
                pid: pid.as_u32(),
                image,
                parent_image,
                is_service,
                session: session_of(pid.as_u32()),
            })
        })
        .collect()
}

#[cfg(windows)]
fn session_of(pid: u32) -> Option<u32> {
    let mut session = 0;
    unsafe { windows::Win32::System::RemoteDesktop::ProcessIdToSessionId(pid, &mut session) }
        .ok()
        .map(|()| session)
}

#[cfg(not(windows))]
fn session_of(_pid: u32) -> Option<u32> {
    None
}

/// Which of `pids` are still running, read the same way as [`snapshot`].
pub fn alive(pids: &[u32]) -> Vec<u32> {
    let processes = snapshot();
    pids.iter()
        .copied()
        .filter(|pid| processes.iter().any(|p| p.pid == *pid))
        .collect()
}

#[cfg(test)]
#[path = "process_snapshot_tests.rs"]
mod tests;
