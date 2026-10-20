use anyhow::{Context, Result};
use std::process::Command as StdCommand;
use std::process::Stdio;
use tokio::process::Command;
use tracing::{info, warn};

#[derive(Debug, Clone)]
pub struct ConsoleUser {
    pub username: String,
    pub uid: u32,
}

pub fn get_console_user() -> Option<ConsoleUser> {
    // Get username from /dev/console owner
    let output = StdCommand::new("stat")
        .args(["-f", "%Su", "/dev/console"])
        .output()
        .ok()?;

    let username = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Filter out: empty, root, and system users (start with _)
    if username.is_empty() || username == "root" || username.starts_with('_') {
        warn!("No regular user at console (got: '{}')", username);
        return None;
    }

    let uid_output = StdCommand::new("id")
        .args(["-u", &username])
        .output()
        .ok()?;

    let uid: u32 = String::from_utf8_lossy(&uid_output.stdout)
        .trim()
        .parse()
        .ok()?;

    info!("Console user: {} (UID: {})", username, uid);
    Some(ConsoleUser { username, uid })
}

pub async fn launch_as_user(
    executable: &str,
    args: &[String],
    user: &ConsoleUser,
) -> Result<tokio::process::Child> {
    if !std::path::Path::new(executable).exists() {
        anyhow::bail!("Executable not found: {}", executable);
    }

    match launch_via_launchctl(executable, args, user.uid).await {
        Ok(child) => return Ok(child),
        Err(e) => {
            warn!("launchctl asuser failed: {:#}, trying sudo -u", e);
        }
    }

    launch_via_sudo(executable, args, &user.username).await
}

pub async fn is_gui_session_ready(uid: u32) -> bool {
    let uid = uid.to_string();
    ["Dock", "Finder"].iter().all(|name| {
        std::process::Command::new("pgrep")
            .args(["-u", &uid, "-x", name])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    })
}

pub async fn is_process_running(executable_path: &str) -> bool {
    match Command::new("pgrep")
        .args(["-f", executable_path])
        .output()
        .await
    {
        Ok(output) => {
            let running = output.status.success();
            if running {
                let pids = String::from_utf8_lossy(&output.stdout);
                info!(
                    "Process already running for {}: PIDs={}",
                    executable_path,
                    pids.trim()
                );
            }
            running
        }
        Err(_) => false,
    }
}

async fn launch_via_launchctl(
    executable: &str,
    args: &[String],
    uid: u32,
) -> Result<tokio::process::Child> {
    if let Some(app_path) = extract_app_bundle_path(executable) {
        info!("Launching .app bundle via launchctl asuser: {}", app_path);

        let mut cmd = Command::new("launchctl");
        cmd.arg("asuser")
            .arg(uid.to_string())
            .args(open_args(&app_path, args));

        let child = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .with_context(|| format!("launchctl asuser {} open -g -a {} failed", uid, app_path))?;

        info!("App launched, PID: {:?}", child.id());
        return Ok(child);
    }

    // Fallback to launchctl for non-.app executables
    info!("Launching via launchctl asuser {}: {}", uid, executable);

    let child = Command::new("launchctl")
        .arg("asuser")
        .arg(uid.to_string())
        .arg(executable)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("launchctl asuser {} failed", uid))?;

    info!("Spawned via launchctl, PID: {:?}", child.id());
    Ok(child)
}

// -g: a daemon launch must not steal focus. No -n: liveness is re-checked right before launching, and a plain open coalesces onto a starting instance.
fn open_args(app_path: &str, args: &[String]) -> Vec<String> {
    let mut open: Vec<String> = ["open", "-g", "-a", app_path]
        .iter()
        .map(|s| s.to_string())
        .collect();
    if !args.is_empty() {
        open.push("--args".to_string());
        open.extend(args.iter().cloned());
    }
    open
}

fn extract_app_bundle_path(executable: &str) -> Option<String> {
    let path = std::path::Path::new(executable);
    for ancestor in path.ancestors() {
        if let Some(name) = ancestor.file_name() {
            if name.to_string_lossy().ends_with(".app") {
                return Some(ancestor.to_string_lossy().to_string());
            }
        }
    }
    None
}

async fn launch_via_sudo(
    executable: &str,
    args: &[String],
    username: &str,
) -> Result<tokio::process::Child> {
    info!("Launching via sudo -u {}: {}", username, executable);

    let child = Command::new("sudo")
        .arg("-u")
        .arg(username)
        .arg(executable)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("sudo -u {} failed", username))?;

    info!("Spawned via sudo, PID: {:?}", child.id());
    Ok(child)
}

#[cfg(test)]
#[path = "macos_tests.rs"]
mod tests;

/// Identifies the current logon at the console: when the user who owns `/dev/console` logged on,
/// from their utmpx `console` entry. `None` while root owns the console (nobody logged on). Not
/// the console's ctime: any write to the console moves it.
pub fn console_logon_id() -> Option<u64> {
    use std::os::unix::fs::MetadataExt;
    use std::sync::{Mutex, PoisonError};

    static UTMPX: Mutex<()> = Mutex::new(());

    let owner = std::fs::metadata("/dev/console").ok()?.uid();
    if owner == 0 {
        return None;
    }
    let user = nix::unistd::User::from_uid(nix::unistd::Uid::from_raw(owner))
        .ok()??
        .name;
    let text = |field: &[libc::c_char]| {
        let bytes: Vec<u8> = field
            .iter()
            .take_while(|c| **c != 0)
            .map(|c| *c as u8)
            .collect();
        String::from_utf8_lossy(&bytes).into_owned()
    };

    let _cursor = UTMPX.lock().unwrap_or_else(PoisonError::into_inner);
    let mut logon = None;
    unsafe {
        libc::setutxent();
        while let Some(entry) = libc::getutxent().as_ref() {
            if entry.ut_type == libc::USER_PROCESS
                && text(&entry.ut_line) == "console"
                && text(&entry.ut_user) == user
            {
                logon = logon.max(Some(entry.ut_tv.tv_sec as u64));
            }
        }
        libc::endutxent();
    }
    logon
}
