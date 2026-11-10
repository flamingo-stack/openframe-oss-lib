use super::HealOutcome;

#[cfg(windows)]
const INSTALLER_URL: &str = "https://go.microsoft.com/fwlink/?linkid=2088631";

#[cfg(windows)]
const DOWNLOAD_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(600);

#[cfg(windows)]
const MAX_INSTALLER_BYTES: u64 = 256 * 1024 * 1024;

#[cfg(windows)]
const INSTALL_WAIT: std::time::Duration = std::time::Duration::from_secs(1200);

const REBOOT_INITIATED: i32 = 1641;
const REBOOT_REQUIRED: i32 = 3010;
const REQUIREMENTS_NOT_MET: i32 = 5100;

#[cfg(windows)]
pub async fn install() -> HealOutcome {
    match try_install().await {
        Ok(outcome) => outcome,
        Err(e) => HealOutcome::Failed(format!("{e:#}")),
    }
}

#[cfg(not(windows))]
pub async fn install() -> HealOutcome {
    HealOutcome::Failed(".NET Framework install is only applicable on Windows".to_string())
}

#[cfg(windows)]
async fn try_install() -> anyhow::Result<HealOutcome> {
    use super::download::CREATE_NO_WINDOW;
    use crate::platform::dotnet_framework::{dotnet_release, DOTNET_4_8_RELEASE};
    use anyhow::Context;
    use tracing::info;

    let installer_path = super::download::microsoft_installer(
        INSTALLER_URL,
        "ndp48-x86-x64-allos-enu",
        ".NET Framework 4.8 installer",
        MAX_INSTALLER_BYTES,
        DOWNLOAD_TIMEOUT,
    )
    .await?;

    info!("Running silent .NET Framework 4.8 install");
    let mut child = match tokio::process::Command::new(&installer_path)
        .args(["/q", "/norestart"])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            let _ = tokio::fs::remove_file(&installer_path).await;
            return Err(e).context("Failed to run the .NET Framework 4.8 installer");
        }
    };

    let Ok(status) = tokio::time::timeout(INSTALL_WAIT, child.wait()).await else {
        return Ok(HealOutcome::Failed(format!(
            ".NET Framework 4.8 installer still running after {} minutes; it finishes in the background, run 'openframe-client doctor' later to check",
            INSTALL_WAIT.as_secs() / 60
        )));
    };
    let _ = tokio::fs::remove_file(&installer_path).await;
    let status = status.context("Failed to wait for the .NET Framework 4.8 installer")?;

    let installed = dotnet_release().is_some_and(|release| release >= DOTNET_4_8_RELEASE);
    Ok(outcome(status.code(), installed))
}

#[cfg_attr(not(windows), allow(dead_code))]
fn outcome(exit_code: Option<i32>, installed: bool) -> HealOutcome {
    match exit_code {
        Some(REBOOT_REQUIRED | REBOOT_INITIATED) => HealOutcome::RestartRequired,
        Some(0) if installed => HealOutcome::Healed,
        Some(0) => HealOutcome::Failed(
            "Installer succeeded but .NET Framework 4.8 still not detected".to_string(),
        ),
        Some(REQUIREMENTS_NOT_MET) => HealOutcome::Failed(
            "This Windows version does not meet the .NET Framework 4.8 requirements".to_string(),
        ),
        Some(code) => {
            HealOutcome::Failed(format!(".NET Framework 4.8 installer exited with {}", code))
        }
        None => HealOutcome::Failed(".NET Framework 4.8 installer was terminated".to_string()),
    }
}

#[cfg(test)]
#[path = "dotnet48_installer_tests.rs"]
mod tests;
