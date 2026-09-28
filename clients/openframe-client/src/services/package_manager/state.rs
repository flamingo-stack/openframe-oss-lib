use super::support;
use super::{ManagerId, Presence};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ManagerState {
    Present,
    Missing,
    Unsupported,
    Unknown,
}

pub async fn state_of(id: ManagerId) -> ManagerState {
    resolve(id.presence().await, support::is_supported(id))
}

fn resolve(presence: Presence, supported: bool) -> ManagerState {
    match (supported, presence) {
        (_, Presence::Present) => ManagerState::Present,
        (false, _) => ManagerState::Unsupported,
        (true, Presence::Absent) => ManagerState::Missing,
        (true, Presence::Unknown) => ManagerState::Unknown,
    }
}

#[cfg(test)]
#[path = "state_tests.rs"]
mod tests;
