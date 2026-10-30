use serde::{Deserialize, Serialize};

use super::PackageRef;

pub const PACKAGE_UPDATE_KIND: &str = "package-update";

/// One update order from the backend; its `DeliveryRef` rides the same envelope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageUpdateMessage {
    pub request_id: String,
    pub source: UpdateSource,
    pub package: PackageRef,
    pub mode: UpdateMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub countdown_seconds: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UpdateMode {
    /// Install when the app is not running; never close it.
    Wait,
    /// Close the app after the countdown, install, relaunch.
    Force,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSource {
    pub kind: SourceKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<SourceOrigin>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SourceKind {
    Auto,
    Manual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SourceOrigin {
    Admin,
    /// The end user's own Update now from the prompt; the only origin allowed a zero countdown.
    User,
}

impl UpdateSource {
    pub fn is_user(&self) -> bool {
        self.origin == Some(SourceOrigin::User)
    }
}

#[cfg(test)]
#[path = "package_update_tests.rs"]
mod tests;
