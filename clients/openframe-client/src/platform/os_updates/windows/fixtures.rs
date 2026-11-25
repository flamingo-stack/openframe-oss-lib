use std::collections::BTreeMap;
#[cfg(target_os = "windows")]
use std::sync::{Mutex, MutexGuard, PoisonError};

use chrono::{DateTime, Utc};

use super::model::*;

#[cfg(target_os = "windows")]
pub(crate) fn lock_wua_reader() -> MutexGuard<'static, ()> {
    static WUA_READER: Mutex<()> = Mutex::new(());
    WUA_READER.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn at(text: &str) -> DateTime<Utc> {
    text.parse().unwrap()
}

pub(crate) fn unreadable<T>() -> Reading<T> {
    Err(ReadError {
        step: "test",
        hresult: Some(-2147024891),
        message: "access denied".into(),
    })
}

pub(crate) fn values(entries: &[(&str, u64)]) -> Reading<Option<RegValues>> {
    Ok(Some(
        entries
            .iter()
            .map(|(name, value)| (name.to_string(), RegValue::Number(*value)))
            .collect(),
    ))
}

/// A Windows 11 Pro 24H2 workstation nobody else manages, with nothing pending.
pub(crate) fn manageable() -> WindowsInventory {
    WindowsInventory {
        read_at: at("2026-11-24T12:00:00Z"),
        read_duration_ms: 4000,
        system: Ok(SystemFacts {
            product_name: Some("Windows 10 Pro".into()),
            edition_id: "Professional".into(),
            composition_edition_id: Some("Enterprise".into()),
            display_version: Some("24H2".into()),
            release_id: Some("2009".into()),
            current_build: "26100".into(),
            ubr: Some(4061),
            installation_type: "Client".into(),
            product_type: "WinNT".into(),
            native_architecture: Some(Architecture::X86_64),
            cluster_node: false,
        }),
        applicable: Ok(ApplicableSet {
            search_succeeded: true,
            search_duration_ms: 3000,
            updates: Vec::new(),
        }),
        last_scan: Ok(ScanDates {
            last_search_success_at: Some(at("2026-11-24T10:00:00Z")),
            last_installation_success_at: None,
        }),
        history: Ok(HistoryWindow {
            total_count: 0,
            scanned: 0,
            dropped_definition_updates: 0,
            entries: Vec::new(),
        }),
        reboot: RebootSignals {
            wua_reboot_required: Ok(false),
            wu_reboot_required_key: Ok(false),
            cbs_reboot_pending: Ok(false),
            cbs_reboot_in_progress: Ok(false),
            pending_file_rename_entries: Ok(0),
        },
        reboot_pending: RebootPending::No,
        management: ManagementSignals {
            wu_policy: Ok(None),
            wu_au_policy: Ok(None),
            wu_ux_settings: Ok(None),
            update_policy_settings: Ok(None),
            mdm_update_policies: Ok(None),
            mdm_enrollments: Ok(Vec::new()),
            domain_joined: Ok(false),
            entra_joined: Ok(false),
            config_mgr_client: Ok(false),
            service_start_types: Ok(BTreeMap::from([
                ("wuauserv".to_string(), Some(3)),
                ("UsoSvc".to_string(), Some(2)),
                ("WaaSMedicSvc".to_string(), Some(3)),
                ("BITS".to_string(), Some(3)),
                ("TrustedInstaller".to_string(), Some(3)),
            ])),
            update_services: Ok(vec![update_service("9482f4b4-e343-43b6-b170-9a65bc822c77")]),
        },
        defender: Ok(None),
        bitlocker: Ok(None),
        write_filter: Ok(None),
    }
}

pub(crate) fn update_service(service_id: &str) -> UpdateService {
    UpdateService {
        service_id: service_id.into(),
        name: "Windows Update".into(),
        is_managed: false,
        is_registered_with_au: true,
        is_default_au_service: true,
    }
}

/// A monthly cumulative update.
pub(crate) fn update() -> WindowsUpdate {
    WindowsUpdate {
        update_id: "11111111-2222-3333-4444-555555555555".into(),
        revision: 200,
        title: "2026-11 Cumulative Update (KB5068861)".into(),
        kb_article_ids: vec!["5068861".into()],
        msrc_severity: Some("Critical".into()),
        categories: vec![category("0fa1201d-4330-4fa8-8ae9-b877473b6441")],
        update_type: Some(UpdateType::Software),
        deployment_action: 1,
        browse_only: false,
        auto_select_on_web_sites: true,
        eula_accepted: true,
        can_request_user_input: false,
        is_uninstallable: true,
        is_downloaded: false,
        max_download_bytes: Some(1_200_000_000),
        reboot_behavior: Some(RebootBehavior::MayRequire),
        requires_exclusive_install: false,
        reboot_required: false,
        last_deployment_change: Some(at("2026-11-10T18:00:00Z")),
        cve_ids: vec!["CVE-2026-1".into()],
    }
}

pub(crate) fn category(id: &str) -> UpdateCategory {
    UpdateCategory {
        id: id.into(),
        name: "Security Updates".into(),
        kind: "UpdateClassification".into(),
    }
}

/// A successful install of a cumulative update on 2026-11-20.
pub(crate) fn installed() -> HistoryEntry {
    HistoryEntry {
        date: Some(at("2026-11-20T03:00:00Z")),
        operation: Some(HistoryOperation::Install),
        result: Some(HistoryResult::Succeeded),
        hresult: 0,
        update_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee".into(),
        revision: 201,
        title: "2026-10 Cumulative Update (KB5066835)".into(),
        client_application_id: "MoUpdateOrchestrator".into(),
    }
}
