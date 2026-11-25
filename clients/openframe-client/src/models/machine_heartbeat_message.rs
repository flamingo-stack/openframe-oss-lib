use serde::{Deserialize, Serialize};

use crate::services::agent_session;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineHeartbeatMessage {
    pub session_id: String,
}

impl Default for MachineHeartbeatMessage {
    fn default() -> Self {
        Self::new()
    }
}

impl MachineHeartbeatMessage {
    pub fn new() -> Self {
        Self {
            session_id: agent_session::session_id().to_string(),
        }
    }
}

#[cfg(test)]
#[path = "machine_heartbeat_message_tests.rs"]
mod tests;
