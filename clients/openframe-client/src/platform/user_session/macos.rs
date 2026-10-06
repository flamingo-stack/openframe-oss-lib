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
            .with_context(|| {
                format!("launchctl asuser {} open -n -g -a {} failed", uid, app_path)
            })?;

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

// -n: a running app gets argv via its single-instance guard (plain `open -a` only re-opens its window); -g: no focus steal.
fn open_args(app_path: &str, args: &[String]) -> Vec<String> {
    let mut open: Vec<String> = ["open", "-n", "-g", "-a", app_path]
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
mod tests {
    use super::*;

    #[test]
    fn open_starts_a_new_instance_without_focus_and_forwards_args() {
        let args = open_args("/Applications/OpenFrame.app", &["--background".to_string()]);
        assert_eq!(
            args,
            [
                "open",
                "-n",
                "-g",
                "-a",
                "/Applications/OpenFrame.app",
                "--args",
                "--background"
            ]
        );
    }

    #[test]
    fn open_without_args_has_no_args_separator() {
        assert_eq!(
            open_args("/Applications/OpenFrame.app", &[]),
            ["open", "-n", "-g", "-a", "/Applications/OpenFrame.app"]
        );
    }

    #[test]
    fn app_bundle_path_is_the_dot_app_ancestor() {
        assert_eq!(
            extract_app_bundle_path("/Applications/OpenFrame.app/Contents/MacOS/openframe-chat")
                .as_deref(),
            Some("/Applications/OpenFrame.app")
        );
        assert_eq!(extract_app_bundle_path("/usr/local/bin/agent"), None);
    }
}
