#[cfg(target_os = "macos")]
mod brew;
mod decide;
#[cfg(target_os = "windows")]
mod winget;

use crate::models::{BrewKind, PackageRef};
use crate::platform::process_snapshot::{self, RunningProcess};
use std::collections::HashMap;
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
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GateDecision {
    Clear,
    Blocked(BlockReason),
}

impl GateDecision {
    pub fn holder_pids(&self) -> Vec<u32> {
        match self {
            GateDecision::Blocked(BlockReason::Running { holders }) => {
                holders.iter().map(|h| h.pid).collect()
            }
            _ => Vec::new(),
        }
    }
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GateResult {
    pub package: PackageRef,
    pub decision: GateDecision,
}

/// Identities resolved once — the expensive part — for answers taken later against a fresh
/// process snapshot, so a verdict is current when an installer actually starts.
pub struct Prepared {
    identities: HashMap<PackageRef, Result<AppIdentity, Undetermined>>,
}

impl Prepared {
    pub async fn check_now(&self, package: &PackageRef) -> GateDecision {
        self.decide(package, &snapshot().await)
    }

    pub fn identity(&self, package: &PackageRef) -> Option<&AppIdentity> {
        self.identities
            .get(package)
            .and_then(|identity| identity.as_ref().ok())
    }

    fn decide(
        &self,
        package: &PackageRef,
        processes: &Result<Vec<RunningProcess>, Undetermined>,
    ) -> GateDecision {
        let identity = self.identities.get(package).cloned().unwrap_or_else(|| {
            Err(Undetermined::Resolver(
                "package was not prepared".to_string(),
            ))
        });
        identity
            .and_then(|identity| {
                processes
                    .as_ref()
                    .map(|processes| decide(&identity, processes))
                    .map_err(Clone::clone)
            })
            .unwrap_or_else(|reason| GateDecision::Blocked(BlockReason::Undetermined(reason)))
    }
}

pub async fn prepare(packages: &[PackageRef]) -> Prepared {
    let identities = resolve(packages).await;
    Prepared {
        identities: packages.iter().cloned().zip(identities).collect(),
    }
}

pub async fn check(packages: &[PackageRef]) -> Vec<GateResult> {
    let prepared = prepare(packages).await;
    let processes = snapshot().await;
    packages
        .iter()
        .map(|package| GateResult {
            package: package.clone(),
            decision: prepared.decide(package, &processes),
        })
        .collect()
}

async fn snapshot() -> Result<Vec<RunningProcess>, Undetermined> {
    tokio::task::spawn_blocking(process_snapshot::snapshot)
        .await
        .map_err(|e| Undetermined::Snapshot(e.to_string()))
}

/// One identity per package, in input order.
async fn resolve(packages: &[PackageRef]) -> Vec<Result<AppIdentity, Undetermined>> {
    #[cfg(target_os = "windows")]
    let winget = winget::resolve(packages).await;
    #[cfg(target_os = "macos")]
    let casks = brew::resolve(packages).await;

    packages
        .iter()
        .map(|package| match package {
            PackageRef::Brew {
                kind: BrewKind::Formula,
                ..
            } => Ok(AppIdentity::NoApp),
            #[cfg(target_os = "windows")]
            PackageRef::Winget { .. } => winget[package].clone(),
            #[cfg(target_os = "macos")]
            PackageRef::Brew {
                kind: BrewKind::Cask,
                ..
            } => casks[package].clone(),
            _ => Err(Undetermined::ManagerUnsupported),
        })
        .collect()
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
