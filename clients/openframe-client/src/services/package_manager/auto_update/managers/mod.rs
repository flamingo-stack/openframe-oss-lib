#[cfg(target_os = "macos")]
mod brew;
#[cfg(target_os = "windows")]
mod winget;

use crate::models::PackageRef;
use crate::services::package_manager::ManagerId;

const OUTDATED_TIMEOUT_SECS: u32 = 300;
/// Also the longest a client self-update can wait for a running upgrade.
const UPGRADE_TIMEOUT_SECS: u32 = 900;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum QueryError {
    /// The manager cannot be queried on this machine right now (e.g. winget without its
    /// PowerShell module). Skipped like an absent manager: not a failure, not retried early.
    Unavailable(String),
    /// The query ran and failed; the pass counts the manager as not answered.
    Failed(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum UpgradeOutcome {
    Upgraded,
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    AlreadyLatest,
    /// Could not run now (files in use, another installer, no session); retried next pass.
    Deferred(String),
    Failed(String),
}

pub(super) async fn outdated(manager: ManagerId) -> Result<Vec<PackageRef>, QueryError> {
    match manager {
        #[cfg(target_os = "windows")]
        ManagerId::Winget => winget::outdated().await,
        #[cfg(target_os = "macos")]
        ManagerId::Brew => brew::outdated().await,
        _ => Err(QueryError::Unavailable(format!(
            "{manager:?} is not supported here"
        ))),
    }
}

pub(super) async fn upgrade(package: &PackageRef) -> UpgradeOutcome {
    match package {
        #[cfg(target_os = "windows")]
        PackageRef::Winget { .. } => winget::upgrade(package).await,
        #[cfg(target_os = "macos")]
        PackageRef::Brew { .. } => brew::upgrade(package).await,
        _ => UpgradeOutcome::Failed(format!("no package manager for {package:?} here")),
    }
}

#[cfg_attr(not(any(target_os = "windows", target_os = "macos")), allow(dead_code))]
fn last_line(output: &str) -> &str {
    output
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or_default()
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
