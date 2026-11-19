use serde::Serialize;

pub const PACKAGE_ADOPT_STATUS_KIND: &str = "package-adopt.status";

pub fn package_adopt_status_subject(machine_id: &str) -> String {
    format!("machine.{}.{}", machine_id, PACKAGE_ADOPT_STATUS_KIND)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageAdoptStatusMessage {
    pub event_id: String,
    pub request_id: String,
    pub machine_id: String,
    pub at: String,
    #[serde(flatten)]
    pub state: AdoptState,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "state",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase"
)]
pub enum AdoptState {
    Done {
        outcome: AdoptOutcome,
        restart_required: bool,
    },
    Failed {
        reason: AdoptFailReason,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AdoptOutcome {
    AdoptedInPlace,
    Reinstalled,
    AlreadyManaged,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AdoptFailReason {
    NotSupported,
    ManagerMissing,
    NoUserSession,
    NotFound,
    IdentityUnknown,
    IdentityMismatch,
    NeedsAdmin,
    RestartPending,
    ManagerError,
    Timeout,
}

#[cfg(test)]
#[path = "package_adopt_status_tests.rs"]
mod tests;
