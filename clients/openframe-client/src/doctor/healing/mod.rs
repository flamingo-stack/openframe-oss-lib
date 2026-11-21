mod dotnet48_installer;
#[cfg(windows)]
mod download;
mod webview2_installer;

use tracing::{info, warn};

use super::{CheckResult, Remediation};

/// Outcome of a single healing action.
#[derive(Debug)]
pub enum HealOutcome {
    Healed,
    RestartRequired,
    StillRunning,
    Failed(String),
}

/// One remediation attempt and how it ended.
#[derive(Debug)]
pub struct HealResult {
    pub remediation: Remediation,
    pub outcome: HealOutcome,
}

/// Remediations flagged in `results`, deduplicated in first-seen order.
pub fn pending(results: &[CheckResult]) -> Vec<Remediation> {
    let mut remediations = Vec::new();
    for result in results {
        if let Some(remediation) = result.remediation {
            if !remediations.contains(&remediation) {
                remediations.push(remediation);
            }
        }
    }
    remediations
}

/// Runs every remediation flagged in `results`; each action verifies its own fix.
pub async fn heal(results: &[CheckResult]) -> Vec<HealResult> {
    let mut heals = Vec::new();
    for remediation in pending(results) {
        heals.push(heal_one(remediation).await);
    }
    heals
}

pub(super) async fn heal_one(remediation: Remediation) -> HealResult {
    info!("Doctor healing: running {:?}", remediation);
    let outcome = run_action(remediation).await;
    match &outcome {
        HealOutcome::Healed => info!("Doctor healing: {:?} healed", remediation),
        HealOutcome::RestartRequired => {
            info!(
                "Doctor healing: {:?} needs a restart to finish",
                remediation
            )
        }
        HealOutcome::StillRunning => {
            info!(
                "Doctor healing: {:?} is still running in the background",
                remediation
            )
        }
        HealOutcome::Failed(e) => warn!("Doctor healing: {:?} failed: {}", remediation, e),
    }
    HealResult {
        remediation,
        outcome,
    }
}

async fn run_action(remediation: Remediation) -> HealOutcome {
    match remediation {
        Remediation::InstallWebview2 => webview2_installer::install().await,
        Remediation::InstallDotnet48 => dotnet48_installer::install().await,
    }
}

#[cfg(windows)]
pub(super) fn installer_running(remediation: Remediation) -> bool {
    download::staged_running(installer_prefix(remediation))
}

#[cfg(not(windows))]
pub(super) fn installer_running(_remediation: Remediation) -> bool {
    false
}

#[cfg(windows)]
pub(super) fn leftover_installers() -> Vec<std::path::PathBuf> {
    download::staged(&[
        installer_prefix(Remediation::InstallWebview2),
        installer_prefix(Remediation::InstallDotnet48),
    ])
}

#[cfg(not(windows))]
pub(super) fn leftover_installers() -> Vec<std::path::PathBuf> {
    Vec::new()
}

#[cfg(windows)]
fn installer_prefix(remediation: Remediation) -> &'static str {
    match remediation {
        Remediation::InstallWebview2 => webview2_installer::INSTALLER_PREFIX,
        Remediation::InstallDotnet48 => dotnet48_installer::INSTALLER_PREFIX,
    }
}

#[cfg(test)]
#[path = "healing_tests.rs"]
mod tests;
