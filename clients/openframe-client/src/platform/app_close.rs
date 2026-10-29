use std::path::Path;

use tracing::{info, warn};

/// Close-button message to each app from the console session; tray apps ignore it, best effort.
#[cfg(target_os = "windows")]
pub async fn ask_to_close(pids: &[u32]) {
    use crate::executor::{execute_script, Privilege, ScriptParams};

    const CLOSE_SCRIPT: &str = r#"foreach ($id in $args) {
    $process = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($process) { [void]$process.CloseMainWindow() }
}
"#;
    const CLOSE_TIMEOUT_SECS: u32 = 30;

    let args: Vec<String> = pids.iter().map(u32::to_string).collect();
    let result = execute_script(ScriptParams {
        code: CLOSE_SCRIPT,
        shell: "powershell",
        args: &args,
        timeout_secs: CLOSE_TIMEOUT_SECS,
        privilege: Privilege::User,
        env_vars: &[],
    })
    .await;
    if result.retcode != 0 {
        warn!(
            retcode = result.retcode,
            stderr = %result.stderr.trim(),
            "Could not ask the apps to close"
        );
    }
}

/// Unix: SIGTERM, which apps treat as a request to quit.
#[cfg(not(target_os = "windows"))]
pub async fn ask_to_close(pids: &[u32]) {
    use sysinfo::{Pid, ProcessRefreshKind, Signal, System};

    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessRefreshKind::new());
    for pid in pids {
        let asked = sys
            .process(Pid::from_u32(*pid))
            .and_then(|process| process.kill_with(Signal::Term));
        if asked == Some(false) {
            warn!(pid, "Could not ask the app to close");
        }
    }
}

/// Reopens a closed app as the console user; true once its launcher succeeded or the app is still up.
#[cfg(target_os = "macos")]
pub async fn reopen(image: &Path) -> bool {
    use std::time::Duration;

    use crate::platform::user_session::{get_console_user, launch_as_user};

    // `open` returns once Launch Services has the app; a bare executable is the app itself.
    const LAUNCH_WAIT: Duration = Duration::from_secs(10);

    let Some(user) = get_console_user() else {
        warn!(image = %image.display(), "No console user to relaunch the app for");
        return false;
    };
    let mut child = match launch_as_user(&image.to_string_lossy(), &[], &user).await {
        Ok(child) => child,
        Err(e) => {
            warn!(image = %image.display(), "Could not relaunch the app: {:#}", e);
            return false;
        }
    };
    match tokio::time::timeout(LAUNCH_WAIT, child.wait()).await {
        Ok(Ok(status)) if !status.success() => {
            warn!(image = %image.display(), %status, "The app did not relaunch");
            false
        }
        Ok(Err(e)) => {
            warn!(image = %image.display(), "Could not wait for the relaunch: {:#}", e);
            false
        }
        _ => {
            info!(image = %image.display(), "Relaunched the app after its forced upgrade");
            true
        }
    }
}

#[cfg(target_os = "windows")]
pub async fn reopen(image: &Path) -> bool {
    use crate::platform::user_session::launch_in_user_session;

    match launch_in_user_session(&image.to_string_lossy(), &[]) {
        Ok(pid) => {
            info!(image = %image.display(), pid, "Relaunched the app after its forced upgrade");
            true
        }
        Err(e) => {
            warn!(image = %image.display(), "Could not relaunch the app: {:#}", e);
            false
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub async fn reopen(image: &Path) -> bool {
    warn!(image = %image.display(), "Relaunching apps is not supported here");
    false
}
