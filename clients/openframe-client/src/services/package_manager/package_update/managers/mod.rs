#[cfg(target_os = "macos")]
mod brew;
#[cfg(target_os = "windows")]
mod winget;

use crate::models::PackageRef;
use crate::services::package_manager::ManagerId;

#[cfg_attr(not(any(target_os = "windows", target_os = "macos")), allow(dead_code))]
const PROBE_TIMEOUT_SECS: u32 = 300;
/// Also the longest a client self-update can wait for a running upgrade.
pub(super) const UPGRADE_TIMEOUT_SECS: u32 = 900;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum QueryError {
    /// The manager cannot be queried on this machine.
    Unavailable(String),
    /// The query ran and failed; worth another try later.
    Failed(String),
}

/// What the manager says about one package right now, with the versions it knows.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Probe {
    pub state: ProbeState,
    pub installed_version: Option<String>,
    pub available_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum ProbeState {
    NotInstalled,
    UpToDate,
    Outdated,
    /// Installed, but this manager will not upgrade it (no source, unknown version, pinned).
    NotUpgradable(String),
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
    /// The manager declined this package (pinned, disabled, nothing for this platform).
    #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
    NotUpgradable(String),
    /// Another installer, a pending reboot or no user session; retried later.
    Busy(String),
    Failed {
        exit_code: i64,
        message: String,
    },
    TimedOut,
}

pub(super) async fn probe(package: &PackageRef) -> Result<Probe, QueryError> {
    match package {
        #[cfg(target_os = "windows")]
        PackageRef::Winget { .. } => winget::probe(package).await,
        #[cfg(target_os = "macos")]
        PackageRef::Brew { .. } => brew::probe(package).await,
        _ => Err(QueryError::Unavailable(format!(
            "{:?} is not supported here",
            ManagerId::of(package)
        ))),
    }
}

/// The manager's own view after an upgrade, without refreshing its catalog first.
pub(super) async fn reread(package: &PackageRef) -> Result<Probe, QueryError> {
    match package {
        #[cfg(target_os = "windows")]
        PackageRef::Winget { .. } => winget::probe(package).await,
        #[cfg(target_os = "macos")]
        PackageRef::Brew { .. } => brew::reread(package).await,
        _ => Err(QueryError::Unavailable(format!(
            "{:?} is not supported here",
            ManagerId::of(package)
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
