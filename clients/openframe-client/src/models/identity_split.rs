use serde::{Deserialize, Serialize};

pub const IDENTITY_SPLIT_KIND: &str = "identity-split";

pub fn identity_split_subject(machine_id: &str) -> String {
    format!("machine.{}.{}", machine_id, IDENTITY_SPLIT_KIND)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IdentitySplitMessage {
    pub session_id: String,
}

#[cfg(test)]
#[path = "identity_split_tests.rs"]
mod tests;
