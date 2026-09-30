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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Session {
    Active,
    None,
}

pub async fn state_of(id: ManagerId, console_user_present: bool) -> ManagerState {
    let session = if console_user_present {
        Session::Active
    } else {
        Session::None
    };

    resolve(id.presence().await, support::is_supported(id), session)
}

fn resolve(presence: Presence, supported: bool, session: Session) -> ManagerState {
    match (supported, presence, session) {
        (_, Presence::Present, _) => ManagerState::Present,
        (false, _, _) => ManagerState::Unsupported,
        (true, Presence::Absent, Session::Active) => ManagerState::Missing,
        (true, Presence::Absent, Session::None) => ManagerState::Unknown,
        (true, Presence::Unknown, _) => ManagerState::Unknown,
    }
}

#[cfg(test)]
#[path = "state_tests.rs"]
mod tests;
