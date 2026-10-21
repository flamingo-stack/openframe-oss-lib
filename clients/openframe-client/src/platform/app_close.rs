use tracing::warn;

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
