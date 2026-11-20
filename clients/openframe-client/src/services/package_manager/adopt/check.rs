use std::cmp::Ordering;
use std::path::{Path, PathBuf};

use super::Refusal;
use crate::models::{AdoptFailReason, AdoptOutcome};
use crate::platform::app_bundle::{bundle_id, short_version};
use crate::platform::process_snapshot::RunningProcess;
use crate::services::package_manager::brew::{Cask, CaskApp};
use crate::services::package_manager::update_gate::{
    self, BlockReason, GateDecision, Undetermined,
};

pub(super) enum Plan<'a> {
    AlreadyManaged,
    Install { app: PathBuf, bundle_id: &'a str },
}

pub(super) fn plan<'a>(
    cask: &Cask,
    bundle_id: Option<&'a str>,
    applications: &Path,
) -> Result<Plan<'a>, Refusal> {
    if cask.installed.is_some() {
        return Ok(Plan::AlreadyManaged);
    }
    let Some(bundle_id) = bundle_id else {
        return Err(Refusal::new(
            AdoptFailReason::IdentityUnknown,
            "the order names no bundle id to check the installed app against",
        ));
    };
    if cask.installs_pkg() {
        return Err(Refusal::new(
            AdoptFailReason::NeedsAdmin,
            "the cask installs a pkg, which needs an administrator",
        ));
    }
    let app = match cask.app(applications) {
        CaskApp::Bundle(app) => app,
        CaskApp::NoApp => {
            return Err(Refusal::new(
                AdoptFailReason::NotSupported,
                "the cask installs no app",
            ))
        }
        CaskApp::Unknown => {
            return Err(Refusal::new(
                AdoptFailReason::NotSupported,
                "the cask installs through an installer, not as an app bundle",
            ))
        }
    };
    match app.try_exists() {
        Ok(true) => {}
        Ok(false) => {
            return Err(Refusal::new(
                AdoptFailReason::NotFound,
                format!("no app at {}, where the cask installs it", app.display()),
            ))
        }
        Err(e) => {
            return Err(Refusal::new(
                AdoptFailReason::IdentityUnknown,
                format!("cannot check {}: {e}", app.display()),
            ))
        }
    }
    same_app(&app, bundle_id)?;
    Ok(Plan::Install { app, bundle_id })
}

pub(super) fn verify(
    cask: &Cask,
    app: &Path,
    bundle_id: &str,
    outcome: AdoptOutcome,
) -> Result<AdoptOutcome, Refusal> {
    if cask.installed.is_none() {
        return Err(Refusal::new(
            AdoptFailReason::ManagerError,
            "brew does not list the cask as installed after the install",
        ));
    }
    same_app(app, bundle_id)?;
    Ok(outcome)
}

pub(super) fn may_force(cask: &Cask, app: &Path, refused: Refusal) -> Result<(), Refusal> {
    if cask.auto_updates == Some(true) {
        return Err(refused);
    }
    let installed = short_version(app)
        .map_err(|e| Refusal::new(AdoptFailReason::VersionUnknown, format!("{e:#}")))?;
    let available = cask.version.as_deref().unwrap_or_default();
    match compare(&installed, available) {
        Some(Ordering::Less) => Ok(()),
        Some(Ordering::Equal) => Err(refused),
        Some(Ordering::Greater) => Err(Refusal::new(
            AdoptFailReason::NotOlder,
            format!(
                "the installed app is {installed}, not older than the cask's {available}; it was not reinstalled"
            ),
        )),
        None => Err(Refusal::new(
            AdoptFailReason::VersionUnknown,
            format!(
                "the installed {installed} cannot be compared with the cask's {available}; it was not reinstalled"
            ),
        )),
    }
}

pub(super) fn not_running(
    app: &Path,
    processes: &Result<Vec<RunningProcess>, Undetermined>,
) -> Result<(), Refusal> {
    match update_gate::check(&Ok(update_gate::app_bundle(app.to_path_buf())), processes) {
        GateDecision::Clear => Ok(()),
        GateDecision::Blocked(BlockReason::Running { holders }) => {
            let pids: Vec<String> = holders
                .iter()
                .map(|holder| holder.pid.to_string())
                .collect();
            Err(Refusal::new(
                AdoptFailReason::AppRunning,
                format!(
                    "the app is open (pid {}); it was not reinstalled",
                    pids.join(", ")
                ),
            ))
        }
        GateDecision::Blocked(BlockReason::Undetermined(reason)) => Err(Refusal::new(
            AdoptFailReason::RunningUnknown,
            format!("cannot tell whether the app is open: {reason}; it was not reinstalled"),
        )),
    }
}

fn compare(installed: &str, cask: &str) -> Option<Ordering> {
    let mut installed = dotted(installed)?;
    let mut cask = dotted(cask.split(',').next()?)?;
    let len = installed.len().max(cask.len());
    installed.resize(len, 0);
    cask.resize(len, 0);
    Some(installed.cmp(&cask))
}

fn dotted(version: &str) -> Option<Vec<u64>> {
    version
        .trim()
        .split('.')
        .map(|part| part.parse().ok())
        .collect()
}

fn same_app(app: &Path, expected: &str) -> Result<(), Refusal> {
    let found = bundle_id(app)
        .map_err(|e| Refusal::new(AdoptFailReason::IdentityUnknown, format!("{e:#}")))?;
    if found.eq_ignore_ascii_case(expected) {
        Ok(())
    } else {
        Err(Refusal::new(
            AdoptFailReason::IdentityMismatch,
            format!("the app at {} is {found}, not {expected}", app.display()),
        ))
    }
}

#[cfg(test)]
#[path = "check_tests.rs"]
mod tests;
