use anyhow::Result;
use std::path::Path;

/// Spawn `<install_path> <subcommand>` detached, so it survives the service manager stopping
/// our own `com.openframe.client` service. macOS + Windows only.
pub fn spawn_detached(install_path: &Path, subcommand: &str) -> Result<u32> {
    #[cfg(target_os = "macos")]
    {
        spawn_detached_macos(install_path, subcommand)
    }
    #[cfg(target_os = "windows")]
    {
        spawn_detached_windows(install_path, subcommand)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (install_path, subcommand);
        anyhow::bail!("detached client subcommands are not supported on this platform")
    }
}

/// Detached child in its own session (setsid) so it outlives launchd stopping our own
/// `com.openframe.client` service — no launchd job/plist needed.
#[cfg(target_os = "macos")]
fn spawn_detached_macos(install_path: &Path, subcommand: &str) -> Result<u32> {
    use anyhow::Context;
    use std::os::unix::process::CommandExt;
    use std::process::{Command, Stdio};

    let child = unsafe {
        Command::new(install_path)
            .arg(subcommand)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            // SAFETY: setsid() is async-signal-safe; it moves the child into a new session so
            // launchd stopping our service can't signal it away mid-run.
            .pre_exec(|| {
                if libc::setsid() == -1 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            })
            .spawn()
    }
    .with_context(|| format!("Failed to spawn detached `{subcommand}` process"))?;

    Ok(child.id())
}

/// Detached child (inherits LocalSystem) so it survives the SCM stopping our service.
#[cfg(target_os = "windows")]
fn spawn_detached_windows(install_path: &Path, subcommand: &str) -> Result<u32> {
    use anyhow::Context;
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    const DETACHED_PROCESS: u32 = 0x0000_0008;

    let child = Command::new(install_path)
        .arg(subcommand)
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
        .spawn()
        .with_context(|| format!("Failed to spawn detached `{subcommand}` process"))?;

    Ok(child.id())
}
