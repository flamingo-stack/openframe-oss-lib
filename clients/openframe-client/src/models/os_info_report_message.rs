use serde::Serialize;

use super::OsVersionNumber;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OsInfoReportMessage {
    pub os_version: OsVersionNumber,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub os_build: String,
}
