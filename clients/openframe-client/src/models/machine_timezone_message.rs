use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct MachineTimezoneMessage {
    pub timezone: String,
}
