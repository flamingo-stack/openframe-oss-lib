use chrono::{DateTime, TimeDelta, Utc};

use super::message::{
    HistoryEntry, LastOsInstall, ListConfidence, MachineOsUpdatesMessage, OsPlatform,
    OsUpdateAuthorization, PatchState, ScanState, UpdateItem, UpdateSet, UpdateState,
    WindowsDetails, WindowsUpdateDetails,
};
use crate::platform::os_updates::windows::{
    self, HistoryOperation, HistoryResult, Manageability, SystemFacts, UpdateType,
    WindowsInventory, DEFENDER_PLATFORM_KB, MALICIOUS_SOFTWARE_REMOVAL_KB,
};

const FRESH_SCAN: TimeDelta = TimeDelta::hours(48);
const AGING_SCAN: TimeDelta = TimeDelta::days(7);
const HISTORY_WINDOW: TimeDelta = TimeDelta::days(30);

pub fn report(
    inventory: &WindowsInventory,
    manageability: &Manageability,
) -> MachineOsUpdatesMessage {
    let system = inventory.system.as_ref().ok();
    MachineOsUpdatesMessage {
        reported_at: inventory.read_at,
        platform: OsPlatform::Windows,
        architecture: system.and_then(|system| system.native_architecture),
        os_version: system.and_then(os_version),
        os_build: system.map(os_build),
        os_product_name: system.and_then(SystemFacts::os_name),
        os_update_authorization: OsUpdateAuthorization::NotRequired,
        manageability: manageability.clone(),
        state: match (manageability, system) {
            (Manageability::Manageable, Some(system)) => Some(update_state(inventory, system)),
            _ => None,
        },
    }
}

fn os_version(system: &SystemFacts) -> Option<String> {
    let version = system
        .display_version
        .as_ref()
        .or(system.release_id.as_ref())?;
    let name = system.os_name().unwrap_or_default();
    match name
        .split_whitespace()
        .find(|word| word.parse::<u32>().is_ok())
    {
        Some(family) => Some(format!("{family} {version}")),
        None => Some(version.clone()),
    }
}

fn os_build(system: &SystemFacts) -> String {
    match system.ubr {
        Some(ubr) => format!("{}.{ubr}", system.current_build),
        None => system.current_build.clone(),
    }
}

fn update_state(inventory: &WindowsInventory, system: &SystemFacts) -> UpdateState {
    let last_scan_at = inventory
        .last_scan
        .as_ref()
        .ok()
        .and_then(|dates| dates.last_search_success_at);
    let scan_state = scan_state(inventory.read_at, last_scan_at);
    let confidence = match &inventory.applicable {
        Err(_) => ListConfidence::Unreadable,
        Ok(set) if set.search_succeeded && last_scan_at.is_some() => ListConfidence::Confirmed,
        Ok(_) => ListConfidence::Unconfirmed,
    };
    let applicable = inventory.applicable.as_ref().ok().map(|set| {
        set.updates
            .iter()
            .filter(|update| !update.is_definition())
            .collect::<Vec<_>>()
    });
    let behind = applicable.iter().flatten().any(|update| {
        update.update_type != Some(UpdateType::Driver)
            && !update.browse_only
            && !update.is_upgrade()
    });
    UpdateState {
        reboot_pending: inventory.reboot_pending,
        patch_state: match (confidence, behind, scan_state) {
            (ListConfidence::Confirmed, true, _) => PatchState::UpdatesAvailable,
            (ListConfidence::Confirmed, false, ScanState::Fresh | ScanState::Aging) => {
                PatchState::UpToDate
            }
            _ => PatchState::Unknown,
        },
        scan_state,
        last_scan_at,
        updates: UpdateSet {
            confidence,
            items: applicable.map(|updates| updates.into_iter().map(update_item).collect()),
        },
        last_os_install: last_os_install(inventory),
        windows: WindowsDetails {
            edition_id: system.edition_id.clone(),
            display_version: system.display_version.clone(),
            installation_type: system.installation_type.clone(),
            product_type: system.product_type.clone(),
            domain_joined: inventory.management.domain_joined.as_ref().ok().copied(),
            domain_controller: system.is_domain_controller(),
            cluster_node: system.cluster_node,
            defender: inventory.defender.as_ref().ok().cloned().flatten(),
            update_services: inventory.management.update_services.as_ref().ok().cloned(),
            history: history(inventory),
        },
    }
}

fn scan_state(now: DateTime<Utc>, last_scan_at: Option<DateTime<Utc>>) -> ScanState {
    let Some(age) = last_scan_at.map(|scanned_at| now - scanned_at) else {
        return ScanState::Unknown;
    };
    if age < TimeDelta::zero() {
        ScanState::Unknown
    } else if age <= FRESH_SCAN {
        ScanState::Fresh
    } else if age <= AGING_SCAN {
        ScanState::Aging
    } else {
        ScanState::Stale
    }
}

fn update_item(update: &windows::WindowsUpdate) -> UpdateItem {
    UpdateItem {
        identifier: identifier(&update.update_id, update.revision),
        display_name: update.title.clone(),
        windows: WindowsUpdateDetails {
            kb_article_ids: update.kb_article_ids.clone(),
            msrc_severity: update.msrc_severity.clone(),
            categories: update.categories.clone(),
            cve_ids: update.cve_ids.clone(),
            published_at: update.last_deployment_change,
            max_download_bytes: update.max_download_bytes,
            is_downloaded: update.is_downloaded,
            reboot_behavior: update.reboot_behavior,
            browse_only: update.browse_only,
            update_type: update.update_type,
            reboot_required: update.reboot_required,
            requires_exclusive_install: update.requires_exclusive_install,
            can_request_user_input: update.can_request_user_input,
            eula_accepted: update.eula_accepted,
            auto_select_on_web_sites: update.auto_select_on_web_sites,
            is_uninstallable: update.is_uninstallable,
        },
    }
}

fn identifier(update_id: &str, revision: i32) -> String {
    format!("{update_id}:{revision}")
}

fn history(inventory: &WindowsInventory) -> Option<Vec<HistoryEntry>> {
    let oldest = inventory.read_at - HISTORY_WINDOW;
    let window = inventory.history.as_ref().ok()?;
    Some(
        window
            .entries
            .iter()
            .filter_map(finished)
            .filter(|entry| entry.installed_at > oldest)
            .collect(),
    )
}

fn last_os_install(inventory: &WindowsInventory) -> Option<LastOsInstall> {
    inventory
        .history
        .as_ref()
        .ok()?
        .entries
        .iter()
        .filter_map(finished)
        .filter(|entry| {
            entry.operation == HistoryOperation::Install
                && entry.result_code == HistoryResult::Succeeded
                && entry.title.contains("KB")
                && !entry.title.contains(DEFENDER_PLATFORM_KB)
                && !entry.title.contains(MALICIOUS_SOFTWARE_REMOVAL_KB)
        })
        .max_by_key(|entry| entry.installed_at)
        .map(|entry| LastOsInstall {
            identifier: identifier(&entry.update_id, entry.revision),
            display_name: entry.title,
            installed_at: entry.installed_at,
        })
}

fn finished(entry: &windows::HistoryEntry) -> Option<HistoryEntry> {
    Some(HistoryEntry {
        update_id: entry.update_id.clone(),
        revision: entry.revision,
        title: entry.title.clone(),
        installed_at: entry.date?,
        operation: entry.operation?,
        result_code: entry.result?,
        hresult: entry.hresult,
    })
}

#[cfg(test)]
#[path = "report_tests.rs"]
mod tests;
