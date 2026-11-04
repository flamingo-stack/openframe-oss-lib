use super::binary_writer::set_executable_permissions;
use crate::utils::version_comparator;
use semver::Version;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;
use tracing::warn;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Runs `<binary> --version`; None when it cannot be run, hangs past `limit`, fails or prints no client version.
pub async fn reported_version(binary: &Path, limit: Duration) -> Option<Version> {
    if let Err(e) = set_executable_permissions(binary).await {
        warn!("{} cannot be made executable: {:#}", binary.display(), e);
        return None;
    }

    // a scan still holding the freshly written exe would make the start fail
    #[cfg(windows)]
    super::binary_writer::wait_until_executable_unlocked(
        binary,
        Duration::from_secs(crate::config::service_stop::EXEC_UNLOCK_WAIT_SECS),
    )
    .await;

    let mut cmd = Command::new(binary);
    cmd.arg("--version").stdin(Stdio::null()).kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let (status, out) = match timeout(limit, cmd.output()).await {
        Ok(Ok(output)) => (output.status, output.stdout),
        Ok(Err(e)) => {
            warn!("Failed to run {} --version: {}", binary.display(), e);
            return None;
        }
        Err(_) => {
            warn!(
                "{} did not answer --version within {:?}",
                binary.display(),
                limit
            );
            return None;
        }
    };

    let output = String::from_utf8_lossy(&out);
    if !status.success() {
        warn!(
            "{} --version exited with {}: {:?}",
            binary.display(),
            status,
            output.trim()
        );
        return None;
    }
    let version = parse_reported_version(&output);
    if version.is_none() {
        warn!(
            "{} --version printed no client version: {:?}",
            binary.display(),
            output.trim()
        );
    }
    version
}

/// Reads the `openframe-client <version>` line clap prints for `--version`.
fn parse_reported_version(output: &str) -> Option<Version> {
    let line = output.lines().map(str::trim).find(|l| !l.is_empty())?;
    let (name, version) = line.split_once(char::is_whitespace)?;
    // lib builds before the explicit name printed `openframe-agent-lib 0.1.0`, which is no client version
    if name != "openframe-client" {
        return None;
    }
    version_comparator::parse_version(version.trim())
}

#[cfg(test)]
#[path = "binary_version_tests.rs"]
mod tests;
