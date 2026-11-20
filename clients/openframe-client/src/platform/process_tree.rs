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
        // Stays in the client's process group (unlike setpgid) so launchd's group kill on client stop still reaches it.
        #[cfg(unix)]
        let _ = super::process_kill::terminate_tree(self.root);
    }
}
