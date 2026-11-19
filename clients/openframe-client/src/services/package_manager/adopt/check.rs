use std::path::{Path, PathBuf};

use super::Refusal;
use crate::models::{AdoptFailReason, AdoptOutcome};
use crate::platform::app_bundle::bundle_id;
use crate::services::package_manager::brew::{Cask, CaskApp};

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
