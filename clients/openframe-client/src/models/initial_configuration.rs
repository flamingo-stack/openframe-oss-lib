use serde::{Deserialize, Serialize};

use super::DeviceTag;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct InitialConfiguration {
    pub server_host: String,
    pub initial_key: String,
    /// Logs-stream key from the install command or fetched later; the initial key is dropped once it is held.
    #[serde(default)]
    pub log_key: String,
    pub local_mode: bool,
    #[serde(default)]
    pub org_id: String,
    #[serde(default)]
    pub user_id: String,
    #[serde(default)]
    pub local_ca_cert_path: String,
    #[serde(default)]
    pub tags: Vec<DeviceTag>,
    /// Install-time remote access mode still waiting for the backend to acknowledge it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote_access_mode: Option<String>,
}
