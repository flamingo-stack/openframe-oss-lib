use serde::{Deserialize, Serialize};

use super::DownloadConfiguration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientUpdateMessage {
    pub version: String,
    pub download_configurations: Vec<DownloadConfiguration>,
}

#[cfg(test)]
#[path = "client_update_message_tests.rs"]
mod tests;
