use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub(super) const WINDOWS_11_FIRST_BUILD: u32 = 22000;
pub(super) const DOMAIN_CONTROLLER: &str = "LanmanNT";
pub const DEFENDER_DEFINITIONS_KB: &str = "2267602";
pub const DEFENDER_PLATFORM_KB: &str = "4052623";
pub const MALICIOUS_SOFTWARE_REMOVAL_KB: &str = "890830";
const DEFINITION_UPDATES: &str = "e0789628-ce08-4437-be74-2495b842f43b";
const UPGRADES: &str = "3689bdc8-b205-4af4-8d4a-a63924c5e9d5";

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
    pub product_name: Option<String>,
    pub edition_id: String,
    pub composition_edition_id: Option<String>,
    pub display_version: Option<String>,
    pub release_id: Option<String>,
    pub current_build: String,
    pub ubr: Option<u32>,
    pub installation_type: String,
    pub product_type: String,
    pub native_architecture: Option<Architecture>,
    pub cluster_node: bool,
}

impl SystemFacts {
    pub fn is_domain_controller(&self) -> bool {
        self.product_type == DOMAIN_CONTROLLER
    }

    pub fn os_name(&self) -> Option<String> {
        let product_name = self.product_name.as_deref()?;
        let build = self.current_build.parse::<u32>().ok()?;
        match product_name.strip_prefix("Windows 10") {
            Some(edition) if build >= WINDOWS_11_FIRST_BUILD => {
                Some(format!("Windows 11{edition}"))
            }
            _ => Some(product_name.to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplicableSet {
    pub search_succeeded: bool,
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
    pub update_type: Option<UpdateType>,
    pub deployment_action: i32,
    pub browse_only: bool,
    pub auto_select_on_web_sites: bool,
    pub eula_accepted: bool,
    pub can_request_user_input: bool,
    pub is_uninstallable: bool,
    pub is_downloaded: bool,
    pub max_download_bytes: Option<u64>,
    pub reboot_behavior: Option<RebootBehavior>,
    pub requires_exclusive_install: bool,
    pub reboot_required: bool,
    pub last_deployment_change: Option<DateTime<Utc>>,
    pub cve_ids: Vec<String>,
}

impl WindowsUpdate {
    pub fn is_definition(&self) -> bool {
        self.in_category(DEFINITION_UPDATES)
            || self
                .kb_article_ids
                .iter()
                .any(|kb| [DEFENDER_DEFINITIONS_KB, DEFENDER_PLATFORM_KB].contains(&kb.as_str()))
    }

    pub fn is_upgrade(&self) -> bool {
        self.in_category(UPGRADES)
    }

    fn in_category(&self, id: &str) -> bool {
        self.categories
            .iter()
            .any(|category| category.id.eq_ignore_ascii_case(id))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Architecture {
    #[serde(rename = "X86_64")]
    X86_64,
    #[serde(rename = "ARM64")]
    Arm64,
}

impl Architecture {
    pub fn from_registry(name: &str) -> Option<Self> {
        match name {
            "AMD64" => Some(Self::X86_64),
            "ARM64" => Some(Self::Arm64),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UpdateType {
    Software,
    Driver,
}

impl UpdateType {
    pub fn from_code(code: i32) -> Option<Self> {
        match code {
            1 => Some(Self::Software),
            2 => Some(Self::Driver),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RebootBehavior {
    Never,
    MayRequire,
    Always,
}

impl RebootBehavior {
    pub fn from_code(code: i32) -> Option<Self> {
        match code {
            0 => Some(Self::Never),
            1 => Some(Self::Always),
            2 => Some(Self::MayRequire),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HistoryOperation {
    Install,
    Uninstall,
}

impl HistoryOperation {
    pub fn from_code(code: i32) -> Option<Self> {
        match code {
            1 => Some(Self::Install),
            2 => Some(Self::Uninstall),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HistoryResult {
    Succeeded,
    SucceededWithErrors,
    Failed,
    Aborted,
}

impl HistoryResult {
    pub fn from_code(code: i32) -> Option<Self> {
        match code {
            2 => Some(Self::Succeeded),
            3 => Some(Self::SucceededWithErrors),
            4 => Some(Self::Failed),
            5 => Some(Self::Aborted),
            _ => None,
        }
    }
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
    pub operation: Option<HistoryOperation>,
    pub result: Option<HistoryResult>,
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

#[cfg(test)]
#[path = "model_tests.rs"]
mod tests;
