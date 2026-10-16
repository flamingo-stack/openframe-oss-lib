use serde::{Deserialize, Serialize};

use super::PackageRef;

/// The `package-policy` command: the full set of packages to keep updated. Its `DeliveryRef`
/// rides the same envelope and orders deliveries by `sequence`.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct PackagePolicyMessage {
    pub packages: Vec<PolicyEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyEntry {
    pub package: PackageRef,
    #[serde(default)]
    pub policy: UpdatePolicy,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePolicy {
    /// Upgrade even when the app is running once it has been outdated this long. Absent: never.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub force_after_seconds: Option<u64>,
}

/// The last applied policy, persisted so a restart keeps it.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct PackagePolicyState {
    #[serde(default)]
    pub machine_id: String,
    pub sequence: i64,
    pub packages: Vec<PolicyEntry>,
}

#[cfg(test)]
#[path = "package_policy_tests.rs"]
mod tests;
