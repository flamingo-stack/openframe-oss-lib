use crate::platform::set_executable_permissions;
use crate::utils::version_comparator;
use anyhow::{anyhow, Result};
use semver::Version;
use std::cmp::Ordering;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::time::timeout;
use tracing::{info, warn};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const OUTPUT_LIMIT_BYTES: u64 = 4096;

/// Refuses the staged binary only when it clearly reports another version; a binary that cannot tell is let through.
pub async fn verify_staged_version(
    binary: &Path,
    expected: &Version,
    limit: Duration,
) -> Result<()> {
    let Some(reported) = reported_version(binary, limit).await else {
        warn!(
            "Could not read the version of the staged binary, installing it unverified as {}",
            expected
        );
        return Ok(());
    };
    if version_comparator::precedence(&reported, expected) != Ordering::Equal {
        return Err(anyhow!(
            "Downloaded binary reports version {}, expected {}; not installing it",
            reported,
            expected
        ));
    }
    info!("Staged binary reports the expected version {}", reported);
    Ok(())
}

/// Runs `<binary> --version`; None when it cannot be run, hangs, fails or prints no version.
async fn reported_version(binary: &Path, limit: Duration) -> Option<Version> {
    if let Err(e) = set_executable_permissions(binary).await {
        warn!("Staged binary cannot be made executable: {:#}", e);
        return None;
    }

    // a scan still holding the freshly written exe would make the start fail and skip the check
    #[cfg(windows)]
    crate::platform::binary_writer::wait_until_executable_unlocked(
        binary,
        Duration::from_secs(crate::config::service_stop::EXEC_UNLOCK_WAIT_SECS),
    )
    .await;

    let mut cmd = Command::new(binary);
    cmd.arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            warn!(
                "Failed to run the staged binary {} --version: {}",
                binary.display(),
                e
            );
            return None;
        }
    };

    let mut stdout = child.stdout.take()?;
    let run = async {
        let mut out = Vec::new();
        (&mut stdout)
            .take(OUTPUT_LIMIT_BYTES)
            .read_to_end(&mut out)
            .await?;
        let status = child.wait().await?;
        Ok::<_, std::io::Error>((status, out))
    };
    let outcome = timeout(limit, run).await;

    let (status, out) = match outcome {
        Ok(Ok(done)) => done,
        Ok(Err(e)) => {
            warn!("Failed to read the staged binary's --version output: {}", e);
            return None;
        }
        Err(_) => {
            warn!(
                "Staged binary did not answer --version within {:?}, killing it",
                limit
            );
            if let Err(e) = child.kill().await {
                warn!("Failed to kill the staged binary's --version run: {}", e);
            }
            return None;
        }
    };

    let output = String::from_utf8_lossy(&out);
    if !status.success() {
        warn!(
            "Staged binary --version exited with {}: {:?}",
            status,
            output.trim()
        );
        return None;
    }
    let version = parse_reported_version(&output);
    if version.is_none() {
        warn!(
            "Staged binary --version printed no version: {:?}",
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
#[path = "staged_binary_probe_tests.rs"]
mod tests;
