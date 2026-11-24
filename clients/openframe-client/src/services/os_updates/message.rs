use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::platform::os_updates::windows::{
    DefenderFacts, Manageability, RebootPending, UpdateCategory, UpdateService,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineOsUpdatesMessage {
    pub reported_at: DateTime<Utc>,
    pub platform: OsPlatform,
    pub architecture: Option<Architecture>,
    pub os_version: Option<String>,
    pub os_build: Option<String>,
    pub os_product_name: Option<String>,
    pub os_update_authorization: OsUpdateAuthorization,
    pub manageability: Manageability,
    #[serde(flatten)]
    pub state: Option<UpdateState>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OsPlatform {
    Windows,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub enum Architecture {
    #[serde(rename = "X86_64")]
    X86_64,
    #[serde(rename = "ARM64")]
    Arm64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OsUpdateAuthorization {
    NotRequired,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateState {
    pub reboot_pending: RebootPending,
    pub patch_state: PatchState,
    pub scan_state: ScanState,
    pub last_scan_at: Option<DateTime<Utc>>,
    pub updates: UpdateSet,
    pub last_os_install: Option<LastOsInstall>,
    pub windows: WindowsDetails,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PatchState {
    UpToDate,
    UpdatesAvailable,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ScanState {
    Fresh,
    Aging,
    Stale,
    Unknown,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSet {
    pub confidence: ListConfidence,
    pub items: Option<Vec<UpdateItem>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ListConfidence {
    Confirmed,
    Unconfirmed,
    Unreadable,
    TooLarge,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItem {
    pub identifier: String,
    pub display_name: String,
    pub windows: WindowsUpdateDetails,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsUpdateDetails {
    pub kb_article_ids: Vec<String>,
    pub msrc_severity: Option<String>,
    pub categories: Vec<UpdateCategory>,
    pub cve_ids: Vec<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub max_download_bytes: Option<u64>,
    pub is_downloaded: bool,
    pub reboot_behavior: Option<RebootBehavior>,
    pub browse_only: bool,
    pub update_type: Option<UpdateType>,
    pub reboot_required: bool,
    pub requires_exclusive_install: bool,
    pub can_request_user_input: bool,
    pub eula_accepted: bool,
    pub auto_select_on_web_sites: bool,
    pub is_uninstallable: bool,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RebootBehavior {
    Never,
    MayRequire,
    Always,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UpdateType {
    Software,
    Driver,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastOsInstall {
    pub identifier: String,
    pub display_name: String,
    pub installed_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsDetails {
    pub edition_id: String,
    pub display_version: Option<String>,
    pub installation_type: String,
    pub product_type: String,
    pub domain_joined: Option<bool>,
    pub domain_controller: bool,
    pub cluster_node: bool,
    pub defender: Option<DefenderFacts>,
    pub update_services: Option<Vec<UpdateService>>,
    pub history: Option<Vec<HistoryEntry>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub update_id: String,
    pub revision: i32,
    pub title: String,
    pub installed_at: DateTime<Utc>,
    pub operation: HistoryOperation,
    pub result_code: HistoryResult,
    pub hresult: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HistoryOperation {
    Install,
    Uninstall,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HistoryResult {
    Succeeded,
    SucceededWithErrors,
    Failed,
    Aborted,
}
