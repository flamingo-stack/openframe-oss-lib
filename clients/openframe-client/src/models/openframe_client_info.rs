use serde::{Deserialize, Serialize};

/// Status of the OpenFrame client update.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum ClientUpdateStatus {
    #[default]
    Current,
    Updating,
    Updated,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenFrameClientInfo {
    pub current_version: String,
    pub target_version: Option<String>,
    pub status: ClientUpdateStatus,
    pub binary_path: String,
    pub last_update_check: Option<String>,
    pub last_updated: Option<String>,
}
