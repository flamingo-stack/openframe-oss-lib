use serde::Deserialize;

use super::PackageRef;

pub const PACKAGE_ADOPT_KIND: &str = "package-adopt";

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageAdoptMessage {
    pub request_id: String,
    pub package: PackageRef,
    pub bundle_id: Option<String>,
}

#[cfg(test)]
#[path = "package_adopt_tests.rs"]
mod tests;
