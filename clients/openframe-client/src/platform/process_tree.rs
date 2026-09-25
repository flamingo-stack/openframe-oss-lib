//! Kills a spawned command with all its descendants, so a timed-out helper can't orphan grandchildren.

use tokio::process::Command;

#[cfg(windows)]
use crate::executor::windows::job::JobHandle;

/// Windows: kill-on-close Job Object (descendants join it); Unix: the child leads its own process group.
pub(crate) struct ProcessTree {
    #[cfg(windows)]
    job: JobHandle,
    #[cfg(unix)]
    pgid: u32,
}

impl ProcessTree {
    /// Must be called on the command before it is spawned.
    pub(crate) fn prepare(cmd: &mut Command) {
        #[cfg(unix)]
        cmd.process_group(0);
        #[cfg(not(unix))]
        let _ = cmd;
    }

    /// Attach to a child spawned from a `prepare`d command; pid 0 yields a no-op tree.
    pub(crate) fn attach(pid: u32) -> Self {
        Self {
            #[cfg(windows)]
            job: JobHandle::for_pid(pid),
            #[cfg(unix)]
            pgid: pid,
        }
    }

    /// Kill the whole tree. Call only while the child is still unreaped, so its pid can't be reused.
    pub(crate) fn kill(&self) {
        #[cfg(windows)]
        self.job.terminate();
        #[cfg(unix)]
        if self.pgid != 0 {
            unsafe {
                libc::kill(-(self.pgid as i32), libc::SIGKILL);
            }
        }
    }
}
