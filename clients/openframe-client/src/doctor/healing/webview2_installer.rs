use super::HealOutcome;

/// Microsoft's permalink to the Evergreen WebView2 bootstrapper.
#[cfg(windows)]
const BOOTSTRAPPER_URL: &str = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";

#[cfg(windows)]
pub(super) const INSTALLER_PREFIX: &str = "MicrosoftEdgeWebView2Setup";

/// The bootstrapper downloads the full runtime during install, so allow plenty of time.
#[cfg(windows)]
const INSTALL_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(600);

#[cfg(windows)]
const DOWNLOAD_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(120);

/// The bootstrapper is ~2 MB; anything larger is not the bootstrapper.
#[cfg(windows)]
const MAX_BOOTSTRAPPER_BYTES: u64 = 32 * 1024 * 1024;

/// Runtime registration can land after the bootstrapper exits, so re-check this many times.
#[cfg(windows)]
const VERIFY_ATTEMPTS: u32 = 12;

#[cfg(windows)]
const VERIFY_POLL_INTERVAL: std::time::Duration = std::time::Duration::from_secs(5);

/// Installs the WebView2 Runtime machine-wide and re-runs the registry check to verify.
#[cfg(windows)]
pub async fn install() -> HealOutcome {
    match try_install().await {
        Ok(()) => HealOutcome::Healed,
        Err(e) => HealOutcome::Failed(format!("{e:#}")),
    }
}

#[cfg(not(windows))]
pub async fn install() -> HealOutcome {
    HealOutcome::Failed("WebView2 install is only applicable on Windows".to_string())
}

#[cfg(windows)]
async fn try_install() -> anyhow::Result<()> {
    use super::download::CREATE_NO_WINDOW;
    use anyhow::{bail, Context};
    use tracing::info;

    let installer_path = super::download::microsoft_installer(
        BOOTSTRAPPER_URL,
        INSTALLER_PREFIX,
        "WebView2 bootstrapper",
        MAX_BOOTSTRAPPER_BYTES,
        DOWNLOAD_TIMEOUT,
    )
    .await?;

    // Running elevated (agent is SYSTEM), the bootstrapper installs machine-wide automatically.
    info!("Running silent WebView2 install");
    // kill_on_drop only reaps the bootstrapper on timeout; its updater child may still finish in the background (caught by the verification poll).
    let run = tokio::time::timeout(
        INSTALL_TIMEOUT,
        tokio::process::Command::new(&installer_path)
            .args(["/silent", "/install"])
            .creation_flags(CREATE_NO_WINDOW)
            .kill_on_drop(true)
            .status(),
    )
    .await;

    let healed = wait_for_machine_wide().await;
    let _ = tokio::fs::remove_file(&installer_path).await;
    if healed {
        return Ok(());
    }

    let status = run
        .context("WebView2 installer timed out")?
        .context("Failed to run WebView2 installer")?;
    if !status.success() {
        bail!("WebView2 installer exited with {}", status);
    }
    bail!("Installer succeeded but machine-wide WebView2 runtime still not detected")
}

/// Polls the registry check so registration landing shortly after the installer finishes still counts.
#[cfg(windows)]
async fn wait_for_machine_wide() -> bool {
    use crate::doctor::{checks::check_webview2_runtime, CheckStatus};

    for attempt in 0..VERIFY_ATTEMPTS {
        if check_webview2_runtime().is_some_and(|r| r.status == CheckStatus::Pass) {
            return true;
        }
        if attempt + 1 < VERIFY_ATTEMPTS {
            tokio::time::sleep(VERIFY_POLL_INTERVAL).await;
        }
    }
    false
}
