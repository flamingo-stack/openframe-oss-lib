//! The client's own auto-update bookkeeping: when passes ran and how long each package has
//! been waiting. Pure apart from `load` / `save`.

use std::path::Path;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tracing::warn;

use crate::models::{PackageRef, PolicyEntry};
use crate::utils::fs::atomic_write;

/// The regular cadence between passes.
pub(super) const TICK_SECS: u64 = 4 * 60 * 60;

#[derive(Debug, Default, PartialEq, Serialize, Deserialize)]
pub(super) struct UpdateState {
    /// The console logon a pass last completed for; a different one means a new logon.
    #[serde(default)]
    logon_pass_done_for: Option<u64>,
    /// Unix seconds; set only by a pass that ran to the end.
    #[serde(default)]
    last_pass_at: Option<u64>,
    #[serde(default)]
    outdated: Vec<Outdated>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct Outdated {
    package: PackageRef,
    since: u64,
}

impl UpdateState {
    pub(super) fn load(path: &Path) -> Self {
        match std::fs::read(path) {
            Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_else(|e| {
                warn!(path = %path.display(), "Auto-update state unreadable, starting over: {:#}", e);
                Self::default()
            }),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Self::default(),
            Err(e) => {
                warn!(path = %path.display(), "Failed to read auto-update state, starting over: {:#}", e);
                Self::default()
            }
        }
    }

    pub(super) fn save(&self, path: &Path) -> Result<()> {
        atomic_write(path, serde_json::to_vec_pretty(self)?)
            .with_context(|| format!("failed to persist auto-update state to {}", path.display()))
    }

    /// Records what one manager reported outdated: policy packages new to the list start their
    /// clock at `now`; that manager's packages no longer reported are up to date and forgotten.
    /// Packages outside the policy are never tracked.
    pub(super) fn observe(
        &mut self,
        policy: &[PolicyEntry],
        of_manager: impl Fn(&PackageRef) -> bool,
        outdated: &[PackageRef],
        now: u64,
    ) {
        self.outdated
            .retain(|o| !of_manager(&o.package) || outdated.contains(&o.package));
        let in_policy = |package: &PackageRef| policy.iter().any(|e| &e.package == package);
        for package in outdated.iter().filter(|package| in_policy(package)) {
            if !self.outdated.iter().any(|o| &o.package == package) {
                self.outdated.push(Outdated {
                    package: package.clone(),
                    since: now,
                });
            }
        }
    }

    pub(super) fn retain(&mut self, policy: &[PolicyEntry]) {
        self.outdated
            .retain(|o| policy.iter().any(|entry| entry.package == o.package));
    }

    pub(super) fn outdated_since(&self, package: &PackageRef) -> Option<u64> {
        self.outdated
            .iter()
            .find(|o| &o.package == package)
            .map(|o| o.since)
    }

    /// Whether a pass should run now: a new console logon, the regular cadence, or a force
    /// deadline that has passed since the last completed pass.
    pub(super) fn is_due(&self, now: u64, logon: Option<u64>, policy: &[PolicyEntry]) -> bool {
        let new_logon = logon.is_some_and(|id| self.logon_pass_done_for != Some(id));
        let last = self.last_pass_at;
        let cadence = last.is_none_or(|last| now >= last.saturating_add(TICK_SECS));
        let deadline = policy.iter().any(|entry| {
            let (Some(after), Some(since)) = (
                entry.policy.force_after_seconds,
                self.outdated_since(&entry.package),
            ) else {
                return false;
            };
            let at = since.saturating_add(after);
            at <= now && last.is_none_or(|last| at > last)
        });
        new_logon || cadence || deadline
    }

    /// Marks a pass that ran to the end. A logon pass counts as done only when every manager
    /// answered; otherwise it is retried.
    pub(super) fn complete_pass(&mut self, now: u64, logon: Option<u64>, all_answered: bool) {
        self.last_pass_at = Some(now);
        if all_answered && logon.is_some() {
            self.logon_pass_done_for = logon;
        }
    }
}

#[cfg(test)]
#[path = "state_tests.rs"]
mod tests;
