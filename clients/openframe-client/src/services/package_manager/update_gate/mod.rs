#[cfg(target_os = "macos")]
mod brew;
mod decide;
#[cfg(target_os = "windows")]
mod winget;

use crate::models::{BrewKind, PackageRef};
use crate::platform::process_snapshot::{self, RunningProcess};
use std::path::PathBuf;

use decide::decide;

const RESOLVE_TIMEOUT_SECS: u32 = 120;

/// What the package manager and the OS say the app is.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AppIdentity {
    /// Installs nothing that runs as an app (brew formula).
    NoApp,
    App {
        install_dir: PathBuf,
        main_images: MainImages,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MainImages {
    /// File names, matched case-insensitively under `install_dir`.
    Derived(Vec<String>),
    /// Could not derive; any root, non-service process under `install_dir` holds it.
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Holder {
    pub pid: u32,
    pub image: PathBuf,
    pub session: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GateDecision {
    Clear,
    Blocked(BlockReason),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BlockReason {
    Running {
        holders: Vec<Holder>,
    },
    /// Could not tell, so the package is held.
    Undetermined(Undetermined),
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum Undetermined {
    #[error("package is not installed")]
    NotInstalled,
    #[error("package manager is not supported by the update gate")]
    ManagerUnsupported,
    #[error("install location could not be determined")]
    NoInstallLocation,
    #[error("identity resolution failed: {0}")]
    Resolver(String),
    #[error("process snapshot failed: {0}")]
    Snapshot(String),
}

/// The identity resolved once, the slow part; each verdict is taken later against a fresh snapshot.
pub struct Prepared {
    identity: Result<AppIdentity, Undetermined>,
}

impl Prepared {
    pub async fn check_now(&self) -> GateDecision {
        match (&self.identity, &snapshot().await) {
            (Ok(identity), Ok(processes)) => decide(identity, processes),
            (Err(reason), _) | (_, Err(reason)) => {
                GateDecision::Blocked(BlockReason::Undetermined(reason.clone()))
            }
        }
    }

    pub fn identity(&self) -> Option<&AppIdentity> {
        self.identity.as_ref().ok()
    }
}

pub async fn prepare(package: &PackageRef) -> Prepared {
    Prepared {
        identity: resolve(package).await,
    }
}

async fn snapshot() -> Result<Vec<RunningProcess>, Undetermined> {
    tokio::task::spawn_blocking(process_snapshot::snapshot)
        .await
        .map_err(|e| Undetermined::Snapshot(e.to_string()))
}

async fn resolve(package: &PackageRef) -> Result<AppIdentity, Undetermined> {
    match package {
        PackageRef::Brew {
            kind: BrewKind::Formula,
            ..
        } => Ok(AppIdentity::NoApp),
        #[cfg(target_os = "windows")]
        PackageRef::Winget { id } => winget::resolve(id).await,
        #[cfg(target_os = "macos")]
        PackageRef::Brew {
            kind: BrewKind::Cask,
            name,
        } => brew::resolve(name).await,
        _ => Err(Undetermined::ManagerUnsupported),
    }
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
