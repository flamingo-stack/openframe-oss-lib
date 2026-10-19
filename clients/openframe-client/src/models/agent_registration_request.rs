use serde::Serialize;

use super::DeviceTag;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRegistrationRequest {
    pub hostname: String,
    pub agent_version: String,
    #[serde(skip_serializing_if = "String::is_empty", default)]
    pub organization_id: String,
    #[serde(skip_serializing_if = "String::is_empty", default)]
    pub user_id: String,
    pub os_type: String,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tags: Vec<DeviceTag>,
}

#[cfg(test)]
#[path = "agent_registration_request_tests.rs"]
mod tests;
