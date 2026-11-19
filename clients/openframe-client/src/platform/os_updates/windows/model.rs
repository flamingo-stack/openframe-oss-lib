use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub type Reading<T> = Result<T, ReadError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadError {
    pub step: &'static str,
    pub hresult: Option<i32>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsInventory {
    pub read_at: DateTime<Utc>,
    pub read_duration_ms: u64,
    pub system: Reading<SystemFacts>,
    pub applicable: Reading<ApplicableSet>,
    pub last_scan: Reading<ScanDates>,
    pub history: Reading<HistoryWindow>,
    pub reboot: RebootSignals,
    pub reboot_pending: RebootPending,
    pub management: ManagementSignals,
    pub defender: Reading<Option<DefenderFacts>>,
    pub bitlocker: Reading<Option<BitLockerFacts>>,
    pub write_filter: Reading<Option<WriteFilterFacts>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFacts {
    pub edition_id: String,
    pub composition_edition_id: Option<String>,
    pub display_version: Option<String>,
    pub release_id: Option<String>,
    pub current_build: String,
    pub ubr: Option<u32>,
    pub installation_type: String,
    pub product_type: String,
    pub native_architecture: String,
    pub cluster_node: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplicableSet {
    pub search_result_code: i32,
    pub search_duration_ms: u64,
    pub updates: Vec<WindowsUpdate>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsUpdate {
    pub update_id: String,
    pub revision: i32,
    pub title: String,
    pub kb_article_ids: Vec<String>,
    pub msrc_severity: Option<String>,
    pub categories: Vec<UpdateCategory>,
    pub update_type: i32,
    pub deployment_action: i32,
    pub browse_only: bool,
    pub auto_select_on_web_sites: bool,
    pub eula_accepted: bool,
    pub can_request_user_input: bool,
    pub is_uninstallable: bool,
    pub is_downloaded: bool,
    pub max_download_bytes: Option<u64>,
    pub reboot_behavior: i32,
    pub impact: i32,
    pub reboot_required: bool,
    pub last_deployment_change: Option<DateTime<Utc>>,
    pub cve_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategory {
    pub id: String,
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanDates {
    pub last_search_success_at: Option<DateTime<Utc>>,
    pub last_installation_success_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryWindow {
    pub total_count: i32,
    pub scanned: u32,
    pub dropped_definition_updates: u32,
    pub entries: Vec<HistoryEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub date: Option<DateTime<Utc>>,
    pub operation: i32,
    pub result_code: i32,
    pub hresult: i32,
    pub update_id: String,
    pub revision: i32,
    pub title: String,
    pub client_application_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebootSignals {
    pub wua_reboot_required: Reading<bool>,
    pub wu_reboot_required_key: Reading<bool>,
    pub cbs_reboot_pending: Reading<bool>,
    pub cbs_reboot_in_progress: Reading<bool>,
    pub pending_file_rename_entries: Reading<usize>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RebootPending {
    Yes,
    No,
    Unknown,
}

impl RebootPending {
    pub fn from_signals(signals: &RebootSignals, applicable: &Reading<ApplicableSet>) -> Self {
        let os_signals = [
            &signals.wua_reboot_required,
            &signals.wu_reboot_required_key,
            &signals.cbs_reboot_pending,
            &signals.cbs_reboot_in_progress,
        ];
        let installed_update_waits = applicable
            .as_ref()
            .is_ok_and(|set| set.updates.iter().any(|update| update.reboot_required));
        if installed_update_waits || os_signals.iter().any(|signal| matches!(signal, Ok(true))) {
            Self::Yes
        } else if os_signals.iter().all(|signal| matches!(signal, Ok(false))) {
            Self::No
        } else {
            Self::Unknown
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum RegValue {
    Number(u64),
    Text(String),
    Texts(Vec<String>),
    Bytes(Vec<u8>),
}

pub type RegValues = BTreeMap<String, RegValue>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagementSignals {
    pub wu_policy: Reading<Option<RegValues>>,
    pub wu_au_policy: Reading<Option<RegValues>>,
    pub wu_ux_settings: Reading<Option<RegValues>>,
    pub update_policy_settings: Reading<Option<RegValues>>,
    pub mdm_update_policies: Reading<Option<RegValues>>,
    pub mdm_enrollments: Reading<Vec<MdmEnrollment>>,
    pub domain_joined: Reading<bool>,
    pub entra_joined: Reading<bool>,
    pub config_mgr_client: Reading<bool>,
    pub service_start_types: Reading<BTreeMap<String, Option<u32>>>,
    pub update_services: Reading<Vec<UpdateService>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdmEnrollment {
    pub provider_id: String,
    pub enrollment_type: Option<u32>,
    pub enrollment_state: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateService {
    pub service_id: String,
    pub name: String,
    pub is_managed: bool,
    pub is_registered_with_au: bool,
    pub is_default_au_service: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefenderFacts {
    pub signature_version: Option<String>,
    pub engine_version: Option<String>,
    pub signatures_updated_at: Option<DateTime<Utc>>,
    pub passive_mode: Option<u32>,
    pub service_start: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitLockerFacts {
    pub mount_point: String,
    pub protection_status: u32,
    pub protector_types: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFilterFacts {
    pub current_enabled: bool,
    pub next_enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Manageability {
    Manageable,
    NotManageable { reasons: Vec<NotManageableReason> },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum NotManageableReason {
    Unreadable,
    UnsupportedEdition,
    UnsupportedVersion,
    WriteFilter,
    Wsus,
    GroupPolicy,
    Mdm,
    ConfigMgr,
    UpdateServiceDisabled,
    #[serde(rename = "BITLOCKER_PRE_BOOT_INPUT")]
    BitLockerPreBootInput,
}
