//! Asks running apps to close the way their user would, so a forced upgrade gives them a chance
//! to save before whatever is left gets terminated.

use tracing::warn;

/// Windows: `CloseMainWindow` from the console user's session — the same message as the close
/// button. A windowless (tray) app ignores it. Best effort: never fails the caller.
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
