//! Apps & Features (Add/Remove Programs) entry for the installed client.

use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use tracing::{info, warn};
use winreg::enums::*;
use winreg::RegKey;

const UNINSTALL_KEY: &str =
    "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\com.openframe.client";
const DISPLAY_NAME: &str = "OpenFrame Client";
const PUBLISHER: &str = "Flamingo AI, Inc.";
const URL_INFO_ABOUT: &str = "https://openframe.ai/";

#[derive(Debug, PartialEq)]
enum EntryValue {
    Text(String),
    Flag(u32),
}

fn powershell_path() -> PathBuf {
    let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
    PathBuf::from(system_root).join("System32\\WindowsPowerShell\\v1.0\\powershell.exe")
}

fn elevated_uninstall_command(install_path: &Path, powershell: &Path) -> String {
    let exe = install_path.display().to_string().replace('\'', "''");
    format!(
        "\"{}\" -NoProfile -WindowStyle Hidden -Command \"Start-Process -FilePath '{}' -ArgumentList 'uninstall' -Verb RunAs -Wait\"",
        powershell.display(),
        exe
    )
}

fn entry_values(
    install_path: &Path,
    version: &str,
    powershell: &Path,
) -> Vec<(&'static str, EntryValue)> {
    let location = install_path
        .parent()
        .map(|dir| dir.display().to_string())
        .unwrap_or_default();

    vec![
        ("DisplayName", EntryValue::Text(DISPLAY_NAME.to_string())),
        ("DisplayVersion", EntryValue::Text(version.to_string())),
        ("Publisher", EntryValue::Text(PUBLISHER.to_string())),
        ("URLInfoAbout", EntryValue::Text(URL_INFO_ABOUT.to_string())),
        ("InstallLocation", EntryValue::Text(location)),
        (
            "DisplayIcon",
            EntryValue::Text(install_path.display().to_string()),
        ),
        (
            "UninstallString",
            EntryValue::Text(elevated_uninstall_command(install_path, powershell)),
        ),
        (
            "QuietUninstallString",
            EntryValue::Text(format!("\"{}\" uninstall", install_path.display())),
        ),
        ("NoModify", EntryValue::Flag(1)),
        ("NoRepair", EntryValue::Flag(1)),
    ]
}

fn register_at(root: &RegKey, key_path: &str, install_path: &Path, version: &str) -> Result<()> {
    let (key, _) = root
        .create_subkey(key_path)
        .context("Failed to create Apps & Features registry key")?;

    for (name, value) in entry_values(install_path, version, &powershell_path()) {
        match value {
            EntryValue::Text(text) => key.set_value(name, &text),
            EntryValue::Flag(flag) => key.set_value(name, &flag),
        }
        .with_context(|| format!("Failed to write Apps & Features value {name}"))?;
    }
    Ok(())
}

fn unregister_at(root: &RegKey, key_path: &str) -> Result<()> {
    match root.delete_subkey_all(key_path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e).context("Failed to remove Apps & Features registry key"),
    }
}

/// Creates or updates the entry for the binary at `install_path`.
pub fn register(install_path: &Path) -> Result<()> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    register_at(
        &hklm,
        UNINSTALL_KEY,
        install_path,
        env!("OPENFRAME_VERSION"),
    )?;
    info!("Apps & Features entry registered");
    Ok(())
}

/// Keeps the entry's version current after a platform update.
pub fn refresh(install_path: &Path) {
    if !is_installed_binary(install_path) {
        return;
    }
    if let Err(e) = register(install_path) {
        warn!("Failed to refresh Apps & Features entry: {:#}", e);
    }
}

/// Removes the entry; succeeds when it does not exist.
pub fn unregister() -> Result<()> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    unregister_at(&hklm, UNINSTALL_KEY)?;
    info!("Apps & Features entry removed");
    Ok(())
}

fn is_installed_binary(install_path: &Path) -> bool {
    let Ok(current) = std::env::current_exe().and_then(std::fs::canonicalize) else {
        return false;
    };
    std::fs::canonicalize(install_path).is_ok_and(|installed| installed == current)
}

#[cfg(test)]
#[path = "apps_entry_tests.rs"]
mod tests;
