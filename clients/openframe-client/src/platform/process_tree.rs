//! Kills a spawned command with all its descendants, so a timed-out helper can't orphan grandchildren.

use tokio::process::Child;

#[cfg(windows)]
use crate::executor::windows::job::JobHandle;

/// Windows: kill-on-close Job Object that descendants join; Unix: the child's pid, whose descendants are found on kill.
pub(crate) struct ProcessTree {
    #[cfg(windows)]
    job: Option<JobHandle>,
    #[cfg(unix)]
    root: u32,
}

impl ProcessTree {
    pub(crate) fn attach(child: &Child) -> Self {
        Self {
            #[cfg(windows)]
            job: child
                .raw_handle()
                .map(|h| JobHandle::for_handle(windows::Win32::Foundation::HANDLE(h as isize))),
            #[cfg(unix)]
            root: child.id().unwrap_or(0),
        }
    }

    /// Kill the whole tree. Call only while the child is still unreaped, so its pid can't be reused.
    pub(crate) fn kill(&self) {
        #[cfg(windows)]
        if let Some(job) = &self.job {
            job.terminate();
        }
        #[cfg(unix)]
        kill_unix_tree(self.root);
    }
}

// Stays in the client's process group (unlike setpgid) so launchd's group kill on client stop still reaches it.
#[cfg(unix)]
fn kill_unix_tree(root: u32) {
    use sysinfo::{ProcessRefreshKind, System};

    if root == 0 {
        return;
    }
    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessRefreshKind::new());
    let links: Vec<(u32, Option<u32>)> = sys
        .processes()
        .iter()
        .map(|(pid, p)| (pid.as_u32(), p.parent().map(|pp| pp.as_u32())))
        .collect();
    for pid in descendants(&links, root).into_iter().chain([root]) {
        unsafe {
            libc::kill(pid as i32, libc::SIGKILL);
        }
    }
}

/// All transitive descendants of `root` from (pid, parent) links, excluding `root` itself.
#[cfg(any(unix, test))]
pub(crate) fn descendants(links: &[(u32, Option<u32>)], root: u32) -> Vec<u32> {
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
#[path = "process_tree_tests.rs"]
mod tests;
