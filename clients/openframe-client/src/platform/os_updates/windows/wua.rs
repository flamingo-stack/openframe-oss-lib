use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::LazyLock;
use std::thread;
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use windows::core::{ComInterface, Error, Result as ComResult, BSTR};
use windows::Win32::Foundation::{DECIMAL, RPC_E_CHANGED_MODE, VARIANT_FALSE};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::UpdateAgent::{
    AutomaticUpdates, IAutomaticUpdates2, ICategoryCollection, IStringCollection,
    ISystemInformation, IUpdate, IUpdate2, IUpdate3, IUpdateSearcher, IUpdateService2,
    IUpdateServiceManager2, IUpdateSession, SystemInformation, UpdateServiceManager, UpdateSession,
};
use windows::Win32::System::Variant::{VARIANT, VT_DATE};

use super::model::{
    ApplicableSet, HistoryEntry, HistoryWindow, ReadError, Reading, ScanDates, UpdateCategory,
    UpdateService, WindowsUpdate,
};
use crate::utils::in_progress::InProgress;

const APPLICABLE_CRITERIA: &str = "IsInstalled=0 and IsHidden=0";
const DEFENDER_DEFINITION_KB: &str = "KB2267602";
const OLE_EPOCH_UNIX_MILLIS: i64 = -2_209_161_600_000;
const HISTORY_SCAN_LIMIT: i32 = 500;
const HISTORY_KEEP_LIMIT: usize = 200;
const TIMEOUT: Duration = Duration::from_secs(120);

static READER: LazyLock<InProgress> = LazyLock::new(InProgress::default);

pub(super) struct WuaReadings {
    pub(super) applicable: Reading<ApplicableSet>,
    pub(super) last_scan: Reading<ScanDates>,
    pub(super) history: Reading<HistoryWindow>,
    pub(super) reboot_required: Reading<bool>,
    pub(super) update_services: Reading<Vec<UpdateService>>,
}

impl WuaReadings {
    fn failed(error: ReadError) -> Self {
        Self {
            applicable: Err(error.clone()),
            last_scan: Err(error.clone()),
            history: Err(error.clone()),
            reboot_required: Err(error.clone()),
            update_services: Err(error),
        }
    }
}

impl ReadError {
    fn com(step: &'static str) -> impl Fn(Error) -> Self {
        move |error| Self {
            step,
            hresult: Some(error.code().0),
            message: error.message().to_string(),
        }
    }
}

struct ComApartment {
    initialized: bool,
}

impl ComApartment {
    fn enter() -> Reading<Self> {
        match unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) } {
            Ok(()) => Ok(Self { initialized: true }),
            Err(error) if error.code() == RPC_E_CHANGED_MODE => Ok(Self { initialized: false }),
            Err(error) => Err(ReadError::com("CoInitializeEx")(error)),
        }
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        if self.initialized {
            unsafe { CoUninitialize() };
        }
    }
}

pub(super) fn read() -> WuaReadings {
    if READER.view().is_active() {
        return WuaReadings::failed(ReadError {
            step: "WUA",
            hresult: None,
            message: "the previous read has not finished".to_string(),
        });
    }
    let reading = READER.begin();
    let (sender, receiver) = mpsc::sync_channel(1);
    let spawned = thread::Builder::new()
        .name("wua-inventory".into())
        .spawn(move || {
            let readings = read_in_apartment();
            drop(reading);
            let _ = sender.send(readings);
        });
    if let Err(error) = spawned {
        return WuaReadings::failed(ReadError::io("WUA thread", error));
    }
    let message = match receiver.recv_timeout(TIMEOUT) {
        Ok(readings) => return readings,
        Err(RecvTimeoutError::Timeout) => format!("no answer within {TIMEOUT:?}"),
        Err(RecvTimeoutError::Disconnected) => "reader thread ended without readings".to_string(),
    };
    WuaReadings::failed(ReadError {
        step: "WUA",
        hresult: None,
        message,
    })
}

fn read_in_apartment() -> WuaReadings {
    let _apartment = match ComApartment::enter() {
        Ok(apartment) => apartment,
        Err(error) => return WuaReadings::failed(error),
    };
    let searcher = unsafe { searcher() }.map_err(ReadError::com("CreateUpdateSearcher"));
    let applicable = searcher
        .as_ref()
        .map_err(Clone::clone)
        .and_then(|searcher| unsafe { applicable(searcher) }.map_err(ReadError::com("Search")));
    let history = searcher
        .as_ref()
        .map_err(Clone::clone)
        .and_then(|searcher| unsafe { history(searcher) }.map_err(ReadError::com("QueryHistory")));
    WuaReadings {
        applicable,
        last_scan: unsafe { last_scan() }.map_err(ReadError::com("AutomaticUpdates")),
        history,
        reboot_required: unsafe { reboot_required() }.map_err(ReadError::com("SystemInformation")),
        update_services: unsafe { update_services() }
            .map_err(ReadError::com("UpdateServiceManager")),
    }
}

unsafe fn searcher() -> ComResult<IUpdateSearcher> {
    let session: IUpdateSession = CoCreateInstance(&UpdateSession, None, CLSCTX_ALL)?;
    let searcher = session.CreateUpdateSearcher()?;
    searcher.SetOnline(VARIANT_FALSE)?;
    Ok(searcher)
}

unsafe fn applicable(searcher: &IUpdateSearcher) -> ComResult<ApplicableSet> {
    let started = Instant::now();
    let result = searcher.Search(&BSTR::from(APPLICABLE_CRITERIA))?;
    let search_duration_ms = started.elapsed().as_millis() as u64;
    let collection = result.Updates()?;
    let mut updates = Vec::new();
    for index in 0..collection.Count()? {
        updates.push(update(&collection.get_Item(index)?)?);
    }
    Ok(ApplicableSet {
        search_result_code: result.ResultCode()?.0,
        search_duration_ms,
        updates,
    })
}

unsafe fn update(update: &IUpdate) -> ComResult<WindowsUpdate> {
    let identity = update.Identity()?;
    let behavior = update.InstallationBehavior()?;
    let update2: IUpdate2 = update.cast()?;
    let update3: IUpdate3 = update.cast()?;
    let severity = update.MsrcSeverity()?.to_string();
    Ok(WindowsUpdate {
        update_id: identity.UpdateID()?.to_string(),
        revision: identity.RevisionNumber()?,
        title: update.Title()?.to_string(),
        kb_article_ids: strings(&update.KBArticleIDs()?)?,
        msrc_severity: (!severity.is_empty()).then_some(severity),
        categories: categories(&update.Categories()?)?,
        update_type: update.Type()?.0,
        deployment_action: update.DeploymentAction()?.0,
        browse_only: update3.BrowseOnly()?.as_bool(),
        auto_select_on_web_sites: update.AutoSelectOnWebSites()?.as_bool(),
        eula_accepted: update.EulaAccepted()?.as_bool(),
        can_request_user_input: behavior.CanRequestUserInput()?.as_bool(),
        is_uninstallable: update.IsUninstallable()?.as_bool(),
        is_downloaded: update.IsDownloaded()?.as_bool(),
        max_download_bytes: decimal_bytes(update.MaxDownloadSize()?),
        reboot_behavior: behavior.RebootBehavior()?.0,
        impact: behavior.Impact()?.0,
        reboot_required: update2.RebootRequired()?.as_bool(),
        last_deployment_change: ole_date(update.LastDeploymentChangeTime()?),
        cve_ids: strings(&update2.CveIDs()?)?,
    })
}

unsafe fn strings(collection: &IStringCollection) -> ComResult<Vec<String>> {
    (0..collection.Count()?)
        .map(|index| Ok(collection.get_Item(index)?.to_string()))
        .collect()
}

unsafe fn categories(collection: &ICategoryCollection) -> ComResult<Vec<UpdateCategory>> {
    (0..collection.Count()?)
        .map(|index| {
            let category = collection.get_Item(index)?;
            Ok(UpdateCategory {
                id: category.CategoryID()?.to_string(),
                name: category.Name()?.to_string(),
                kind: category.Type()?.to_string(),
            })
        })
        .collect()
}

unsafe fn history(searcher: &IUpdateSearcher) -> ComResult<HistoryWindow> {
    let total_count = searcher.GetTotalHistoryCount()?;
    let mut window = HistoryWindow {
        total_count,
        scanned: 0,
        dropped_definition_updates: 0,
        entries: Vec::new(),
    };
    let requested = total_count.min(HISTORY_SCAN_LIMIT);
    if requested <= 0 {
        return Ok(window);
    }
    let entries = searcher.QueryHistory(0, requested)?;
    for index in 0..entries.Count()? {
        let entry = entries.get_Item(index)?;
        window.scanned += 1;
        let title = entry.Title()?.to_string();
        if title.contains(DEFENDER_DEFINITION_KB) {
            window.dropped_definition_updates += 1;
            continue;
        }
        if window.entries.len() >= HISTORY_KEEP_LIMIT {
            break;
        }
        let identity = entry.UpdateIdentity()?;
        window.entries.push(HistoryEntry {
            date: ole_date(entry.Date()?),
            operation: entry.Operation()?.0,
            result_code: entry.ResultCode()?.0,
            hresult: entry.HResult()?,
            update_id: identity.UpdateID()?.to_string(),
            revision: identity.RevisionNumber()?,
            title,
            client_application_id: entry.ClientApplicationID()?.to_string(),
        });
    }
    Ok(window)
}

unsafe fn last_scan() -> ComResult<ScanDates> {
    let updates: IAutomaticUpdates2 = CoCreateInstance(&AutomaticUpdates, None, CLSCTX_ALL)?;
    let results = updates.Results()?;
    Ok(ScanDates {
        last_search_success_at: variant_date(&results.LastSearchSuccessDate()?),
        last_installation_success_at: variant_date(&results.LastInstallationSuccessDate()?),
    })
}

unsafe fn reboot_required() -> ComResult<bool> {
    let info: ISystemInformation = CoCreateInstance(&SystemInformation, None, CLSCTX_ALL)?;
    Ok(info.RebootRequired()?.as_bool())
}

unsafe fn update_services() -> ComResult<Vec<UpdateService>> {
    let manager: IUpdateServiceManager2 =
        CoCreateInstance(&UpdateServiceManager, None, CLSCTX_ALL)?;
    let services = manager.Services()?;
    (0..services.Count()?)
        .map(|index| {
            let service = services.get_Item(index)?;
            let service2: IUpdateService2 = service.cast()?;
            Ok(UpdateService {
                service_id: service.ServiceID()?.to_string(),
                name: service.Name()?.to_string(),
                is_managed: service.IsManaged()?.as_bool(),
                is_registered_with_au: service.IsRegisteredWithAU()?.as_bool(),
                is_default_au_service: service2.IsDefaultAUService()?.as_bool(),
            })
        })
        .collect()
}

fn ole_date(days: f64) -> Option<DateTime<Utc>> {
    if !days.is_finite() || days <= 0.0 {
        return None;
    }
    DateTime::from_timestamp_millis((days * 86_400_000.0).round() as i64 + OLE_EPOCH_UNIX_MILLIS)
}

fn variant_date(value: &VARIANT) -> Option<DateTime<Utc>> {
    let inner = unsafe { &value.Anonymous.Anonymous };
    if inner.vt == VT_DATE {
        ole_date(unsafe { inner.Anonymous.date })
    } else {
        None
    }
}

fn decimal_bytes(value: DECIMAL) -> Option<u64> {
    let (scale, sign, low) = unsafe {
        (
            value.Anonymous1.Anonymous.scale,
            value.Anonymous1.Anonymous.sign,
            value.Anonymous2.Lo64,
        )
    };
    if sign != 0 {
        return None;
    }
    let mantissa = (u128::from(value.Hi32) << 64) | u128::from(low);
    u64::try_from(mantissa / 10u128.checked_pow(u32::from(scale))?).ok()
}

#[cfg(test)]
#[path = "wua_tests.rs"]
mod tests;
