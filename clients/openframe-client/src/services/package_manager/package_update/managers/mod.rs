#[cfg(target_os = "macos")]
mod brew;
#[cfg(target_os = "windows")]
mod winget;

use crate::models::PackageRef;
use crate::services::package_manager::ManagerId;

const OUTDATED_TIMEOUT_SECS: u32 = 300;
/// Also the longest a client self-update can wait for a running upgrade.
pub(super) const UPGRADE_TIMEOUT_SECS: u32 = 900;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum QueryError {
    /// The manager cannot be queried on this machine (e.g. winget without its PowerShell module).
    Unavailable(String),
    /// The query ran and failed; worth another try later.
    Failed(String),
}

/// A package the manager reports an update for, with the versions it knows.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct OutdatedPackage {
    pub package: PackageRef,
    pub installed_version: Option<String>,
    pub available_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum UpgradeOutcome {
    Upgraded {
        reboot_required: bool,
    },
    #[cfg_attr(not(any(target_os = "windows", target_os = "macos")), allow(dead_code))]
    AlreadyLatest,
    /// The app's files are in use: a holder the gate did not see.
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    InUse(String),
    /// Another installer, a pending reboot or no user session; retried later.
    Busy(String),
    Failed {
        exit_code: i64,
        message: String,
    },
    TimedOut,
}

pub(super) async fn outdated(manager: ManagerId) -> Result<Vec<OutdatedPackage>, QueryError> {
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
        _ => UpgradeOutcome::Failed {
            exit_code: 0,
            message: format!("no package manager for {package:?} here"),
        },
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
