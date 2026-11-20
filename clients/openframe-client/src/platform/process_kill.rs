//! Kills processes by pid without `taskkill.exe`, which needs WMI and fails on a host whose WMI repository is broken.

use std::io;

use sysinfo::{ProcessRefreshKind, System};
use tracing::warn;

/// Kills one process at once: `TerminateProcess` on Windows, `SIGKILL` on Unix.
#[cfg(windows)]
pub(crate) fn terminate(pid: u32) -> io::Result<()> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

    unsafe {
        let handle =
            OpenProcess(PROCESS_TERMINATE, false, pid).map_err(|_| io::Error::last_os_error())?;
        let terminated = TerminateProcess(handle, 1).map_err(|_| io::Error::last_os_error());
        let _ = CloseHandle(handle);
        terminated
    }
}

/// Kills one process at once: `TerminateProcess` on Windows, `SIGKILL` on Unix.
#[cfg(unix)]
pub(crate) fn terminate(pid: u32) -> io::Result<()> {
    let pid = libc::pid_t::try_from(pid)
        .ok()
        .filter(|pid| *pid > 0)
        .ok_or_else(|| io::Error::from(io::ErrorKind::InvalidInput))?;
    if unsafe { libc::kill(pid, libc::SIGKILL) } == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

/// Kills `root` and every process descended from it, descendants first; the result is the root's.
pub(crate) fn terminate_tree(root: u32) -> io::Result<()> {
    if root == 0 {
        return Err(io::Error::from(io::ErrorKind::InvalidInput));
    }
    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessRefreshKind::new());
    let links: Vec<(u32, Option<u32>)> = sys
        .processes()
        .iter()
        .map(|(pid, process)| {
            let parent = process
                .parent()
                .and_then(|parent| sys.process(parent))
                .filter(|parent| parent.start_time() <= process.start_time())
                .map(|parent| parent.pid().as_u32());
            (pid.as_u32(), parent)
        })
        .collect();
    for pid in descendants(&links, root) {
        if let Err(e) = terminate(pid) {
            warn!(pid, root, error = %e, "Failed to kill a descendant process");
        }
    }
    terminate(root)
}

/// All transitive descendants of `root` from (pid, parent) links, excluding `root` itself.
fn descendants(links: &[(u32, Option<u32>)], root: u32) -> Vec<u32> {
    let mut found = Vec::new();
    let mut frontier = vec![root];
    while let Some(parent) = frontier.pop() {
        for &(pid, pp) in links {
            if pp == Some(parent) && pid != root && !found.contains(&pid) {
                found.push(pid);
                frontier.push(pid);
            }
        }
    }
    found
}

#[cfg(test)]
#[path = "process_kill_tests.rs"]
mod tests;
