use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineHeartbeatMessage {
    // Empty object - machineId comes from topic name, timestamp generated at service side
}

impl Default for MachineHeartbeatMessage {
    fn default() -> Self {
        Self::new()
    }
}

impl MachineHeartbeatMessage {
    pub fn new() -> Self {
        Self {}
    }
}
