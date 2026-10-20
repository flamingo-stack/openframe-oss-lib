use serde::{Deserialize, Serialize};

use super::{PackageRef, UpdateSource};

pub const PACKAGE_UPDATE_STATUS_KIND: &str = "package-update.status";

pub fn package_update_status_subject(machine_id: &str) -> String {
    format!("machine.{}.{}", machine_id, PACKAGE_UPDATE_STATUS_KIND)
}

/// One lifecycle event of an update request; the detail lives in the state's own object.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageUpdateStatusMessage {
    pub event_id: String,
    pub request_id: String,
    pub machine_id: String,
    pub at: String,
    pub source: UpdateSource,
    pub package: PackageRef,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub installed_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub available_version: Option<String>,
    pub state: UpdateStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub waiting: Option<Waiting>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub done: Option<Done>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failed: Option<Failed>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UpdateStatus {
    Waiting,
    Done,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Waiting {
    pub reason: WaitReason,
    pub phase: WaitPhase,
    #[serde(default)]
    pub holders: Vec<HolderInfo>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub closes_at: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WaitReason {
    AppRunning,
    ManagerBusy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WaitPhase {
    Prompt,
    Countdown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HolderInfo {
    pub app: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Done {
    pub result: DoneResult,
    pub reboot_required: bool,
    pub relaunched: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DoneResult {
    Upgraded,
    AlreadyLatest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Failed {
    pub reason: FailReason,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FailReason {
    ManagerError,
    ManagerMissing,
    CloseFailed,
    Timeout,
    NotSupported,
    Superseded,
}

#[cfg(test)]
#[path = "package_update_status_tests.rs"]
mod tests;
