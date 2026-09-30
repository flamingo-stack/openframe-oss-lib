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

pub async fn state_of(id: ManagerId, console_user_present: bool) -> ManagerState {
    resolve(
        id.presence().await,
        support::is_supported(id),
        console_user_present,
    )
}

fn resolve(presence: Presence, supported: bool, console_user_present: bool) -> ManagerState {
    match (supported, presence, console_user_present) {
        (_, Presence::Present, _) => ManagerState::Present,
        (false, _, _) => ManagerState::Unsupported,
        (true, Presence::Absent, true) => ManagerState::Missing,
        (true, Presence::Absent, false) => ManagerState::Unknown,
        (true, Presence::Unknown, _) => ManagerState::Unknown,
    }
}

#[cfg(test)]
#[path = "state_tests.rs"]
mod tests;
