use std::collections::BTreeMap;
use std::io;

use chrono::{DateTime, Utc};
use windows::core::{HRESULT, PCWSTR, PWSTR};
use windows::Win32::NetworkManagement::NetManagement::{
    NetApiBufferFree, NetGetJoinInformation, NetSetupDomainName, NETSETUP_JOIN_STATUS,
};
use winreg::enums::{
    HKEY_LOCAL_MACHINE, REG_DWORD, REG_EXPAND_SZ, REG_MULTI_SZ, REG_QWORD, REG_SZ,
};
use winreg::types::FromRegValue;
use winreg::RegKey;

use super::model::{
    Architecture, DefenderFacts, MdmEnrollment, ReadError, Reading, RegValue, RegValues,
    SystemFacts,
};

const CURRENT_VERSION: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";
const PRODUCT_OPTIONS: &str = r"SYSTEM\CurrentControlSet\Control\ProductOptions";
const SESSION_ENVIRONMENT: &str = r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment";
const SESSION_MANAGER: &str = r"SYSTEM\CurrentControlSet\Control\Session Manager";
const CLUSTER: &str = "Cluster";
const ENROLLMENTS: &str = r"SOFTWARE\Microsoft\Enrollments";
const DEFENDER: &str = r"SOFTWARE\Microsoft\Windows Defender";
const DEFENDER_SIGNATURES: &str = r"SOFTWARE\Microsoft\Windows Defender\Signature Updates";
const DEFENDER_SERVICE: &str = r"SYSTEM\CurrentControlSet\Services\WinDefend";
const SERVICES: &str = r"SYSTEM\CurrentControlSet\Services";
const FILETIME_TICKS_TO_UNIX_EPOCH: i64 = 116_444_736_000_000_000;

impl ReadError {
    pub(super) fn io(step: &'static str, error: io::Error) -> Self {
        Self {
            step,
            hresult: error
                .raw_os_error()
                .map(|code| HRESULT::from_win32(code as u32).0),
            message: error.to_string(),
        }
    }
}

fn hklm() -> RegKey {
    RegKey::predef(HKEY_LOCAL_MACHINE)
}

fn open_if_present(path: &'static str) -> Reading<Option<RegKey>> {
    match hklm().open_subkey(path) {
        Ok(key) => Ok(Some(key)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(ReadError::io(path, error)),
    }
}

fn optional<T: FromRegValue>(key: &RegKey, name: &str) -> Option<T> {
    key.get_value(name).ok()
}

pub(super) fn system_facts() -> Reading<SystemFacts> {
    let version = hklm()
        .open_subkey(CURRENT_VERSION)
        .map_err(|error| ReadError::io(CURRENT_VERSION, error))?;
    let required = |name: &str| -> Reading<String> {
        version
            .get_value(name)
            .map_err(|error| ReadError::io(CURRENT_VERSION, error))
    };
    let product_type = hklm()
        .open_subkey(PRODUCT_OPTIONS)
        .and_then(|key| key.get_value("ProductType"))
        .map_err(|error| ReadError::io(PRODUCT_OPTIONS, error))?;
    let native_architecture: String = hklm()
        .open_subkey(SESSION_ENVIRONMENT)
        .and_then(|key| key.get_value("PROCESSOR_ARCHITECTURE"))
        .map_err(|error| ReadError::io(SESSION_ENVIRONMENT, error))?;
    Ok(SystemFacts {
        product_name: optional(&version, "ProductName"),
        edition_id: required("EditionID")?,
        composition_edition_id: optional(&version, "CompositionEditionID"),
        display_version: optional(&version, "DisplayVersion"),
        release_id: optional(&version, "ReleaseId"),
        current_build: required("CurrentBuild")?,
        ubr: optional(&version, "UBR"),
        installation_type: required("InstallationType")?,
        product_type,
        native_architecture: Architecture::from_registry(&native_architecture),
        cluster_node: open_if_present(CLUSTER)?.is_some(),
    })
}

pub(super) fn key_exists(path: &'static str) -> Reading<bool> {
    Ok(open_if_present(path)?.is_some())
}

pub(super) fn has_subkeys(path: &'static str) -> Reading<bool> {
    match open_if_present(path)? {
        Some(key) => Ok(key.enum_keys().next().is_some()),
        None => Ok(false),
    }
}

pub(super) fn values(path: &'static str) -> Reading<Option<RegValues>> {
    let Some(key) = open_if_present(path)? else {
        return Ok(None);
    };
    let mut values = RegValues::new();
    for entry in key.enum_values() {
        let (name, raw) = entry.map_err(|error| ReadError::io(path, error))?;
        values.insert(name, reg_value(raw));
    }
    Ok(Some(values))
}

fn reg_value(raw: winreg::RegValue) -> RegValue {
    let parsed = match &raw.vtype {
        REG_DWORD => u32::from_reg_value(&raw)
            .ok()
            .map(|n| RegValue::Number(n.into())),
        REG_QWORD => u64::from_reg_value(&raw).ok().map(RegValue::Number),
        REG_SZ | REG_EXPAND_SZ => String::from_reg_value(&raw).ok().map(RegValue::Text),
        REG_MULTI_SZ => Vec::<String>::from_reg_value(&raw)
            .ok()
            .map(RegValue::Texts),
        _ => None,
    };
    parsed.unwrap_or(RegValue::Bytes(raw.bytes))
}

pub(super) fn service_start_types(names: &[&str]) -> Reading<BTreeMap<String, Option<u32>>> {
    let services = hklm()
        .open_subkey(SERVICES)
        .map_err(|error| ReadError::io(SERVICES, error))?;
    names
        .iter()
        .map(|name| {
            let start = match services.open_subkey(name) {
                Ok(key) => Some(
                    key.get_value("Start")
                        .map_err(|error| ReadError::io(SERVICES, error))?,
                ),
                Err(error) if error.kind() == io::ErrorKind::NotFound => None,
                Err(error) => return Err(ReadError::io(SERVICES, error)),
            };
            Ok((name.to_string(), start))
        })
        .collect()
}

pub(super) fn pending_file_rename_entries() -> Reading<usize> {
    let key = hklm()
        .open_subkey(SESSION_MANAGER)
        .map_err(|error| ReadError::io(SESSION_MANAGER, error))?;
    match key.get_value::<Vec<String>, _>("PendingFileRenameOperations") {
        Ok(entries) => Ok(entries.len()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(0),
        Err(error) => Err(ReadError::io(SESSION_MANAGER, error)),
    }
}

pub(super) fn mdm_enrollments() -> Reading<Vec<MdmEnrollment>> {
    match open_if_present(ENROLLMENTS)? {
        Some(root) => enrollments_under(&root),
        None => Ok(Vec::new()),
    }
}

fn enrollments_under(root: &RegKey) -> Reading<Vec<MdmEnrollment>> {
    let mut enrollments = Vec::new();
    for name in root.enum_keys() {
        let name = name.map_err(|error| ReadError::io(ENROLLMENTS, error))?;
        let key = match root.open_subkey(&name) {
            Ok(key) => key,
            Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
            Err(error) => return Err(ReadError::io(ENROLLMENTS, error)),
        };
        let provider_id: String = match key.get_value("ProviderID") {
            Ok(provider_id) => provider_id,
            Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
            Err(error) => return Err(ReadError::io(ENROLLMENTS, error)),
        };
        if provider_id.is_empty() {
            continue;
        }
        enrollments.push(MdmEnrollment {
            provider_id,
            enrollment_type: optional(&key, "EnrollmentType"),
            enrollment_state: optional(&key, "EnrollmentState"),
        });
    }
    Ok(enrollments)
}

pub(super) fn domain_joined() -> Reading<bool> {
    let mut name = PWSTR::null();
    let mut status = NETSETUP_JOIN_STATUS::default();
    let code = unsafe { NetGetJoinInformation(PCWSTR::null(), &mut name, &mut status) };
    if !name.is_null() {
        unsafe { NetApiBufferFree(Some(name.0 as *const _)) };
    }
    if code != 0 {
        return Err(ReadError {
            step: "NetGetJoinInformation",
            hresult: Some(HRESULT::from_win32(code).0),
            message: io::Error::from_raw_os_error(code as i32).to_string(),
        });
    }
    Ok(status == NetSetupDomainName)
}

pub(super) fn defender() -> Reading<Option<DefenderFacts>> {
    let Some(signatures) = open_if_present(DEFENDER_SIGNATURES)? else {
        return Ok(None);
    };
    let signatures_updated_at = signatures
        .get_raw_value("SignaturesLastUpdated")
        .ok()
        .and_then(|raw| <[u8; 8]>::try_from(raw.bytes.as_slice()).ok())
        .and_then(|bytes| {
            let ticks = i64::from_le_bytes(bytes);
            let hundred_ns = ticks.checked_sub(FILETIME_TICKS_TO_UNIX_EPOCH)?;
            DateTime::<Utc>::from_timestamp(
                hundred_ns.div_euclid(10_000_000),
                (hundred_ns.rem_euclid(10_000_000) * 100) as u32,
            )
        });
    let root = open_if_present(DEFENDER)?;
    let service = open_if_present(DEFENDER_SERVICE)?;
    Ok(Some(DefenderFacts {
        signature_version: optional(&signatures, "AVSignatureVersion"),
        engine_version: optional(&signatures, "EngineVersion"),
        signatures_updated_at,
        passive_mode: root.as_ref().and_then(|key| optional(key, "PassiveMode")),
        service_start: service.as_ref().and_then(|key| optional(key, "Start")),
    }))
}

#[cfg(test)]
#[path = "machine_tests.rs"]
mod tests;
