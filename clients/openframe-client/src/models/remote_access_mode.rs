use clap::ValueEnum;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Remote access mode an install command can preset as the device's override.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RemoteAccessMode {
    ApprovalRequired,
    NotifyOnly,
    SilentAccess,
    DenyAccess,
}

impl RemoteAccessMode {
    /// The backend's name for the mode, which is also what the install configuration persists.
    pub fn wire_name(self) -> String {
        serde_json::to_value(self)
            .ok()
            .and_then(|value| value.as_str().map(str::to_owned))
            .expect("a unit variant serializes to a string")
    }

    /// Parses a persisted backend name; `None` for a name this client doesn't know.
    pub fn from_wire_name(name: &str) -> Option<Self> {
        serde_json::from_value(Value::String(name.to_owned())).ok()
    }
}

#[cfg(test)]
#[path = "remote_access_mode_tests.rs"]
mod tests;
