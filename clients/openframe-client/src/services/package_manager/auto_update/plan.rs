//! What to do with one outdated package right now. Pure.

use crate::models::UpdatePolicy;
use crate::services::package_manager::update_gate::GateDecision;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Action {
    Upgrade,
    /// The admin's deadline passed: upgrade even though the gate holds it.
    Force,
    Wait {
        force_at: Option<u64>,
    },
}

pub(super) fn decide(
    gate: &GateDecision,
    policy: &UpdatePolicy,
    outdated_since: u64,
    now: u64,
) -> Action {
    if *gate == GateDecision::Clear {
        return Action::Upgrade;
    }
    match policy.force_after_seconds {
        Some(after) if now >= outdated_since.saturating_add(after) => Action::Force,
        Some(after) => Action::Wait {
            force_at: Some(outdated_since.saturating_add(after)),
        },
        None => Action::Wait { force_at: None },
    }
}

#[cfg(test)]
#[path = "plan_tests.rs"]
mod tests;
