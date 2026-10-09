//! Apps & Features (Add/Remove Programs) entry for the installed client.

use std::io::ErrorKind;
use std::path::Path;

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

fn entry_values(install_path: &Path, version: &str) -> Vec<(&'static str, EntryValue)> {
    let uninstall = format!("\"{}\" uninstall", install_path.display());
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
        ("UninstallString", EntryValue::Text(uninstall.clone())),
        ("QuietUninstallString", EntryValue::Text(uninstall)),
        ("NoModify", EntryValue::Flag(1)),
        ("NoRepair", EntryValue::Flag(1)),
    ]
}

/// Creates or updates the entry for the binary at `install_path`.
pub fn register(install_path: &Path) -> Result<()> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let (key, _) = hklm
        .create_subkey(UNINSTALL_KEY)
        .context("Failed to create Apps & Features registry key")?;

    for (name, value) in entry_values(install_path, env!("OPENFRAME_VERSION")) {
        match value {
            EntryValue::Text(text) => key.set_value(name, &text),
            EntryValue::Flag(flag) => key.set_value(name, &flag),
        }
        .with_context(|| format!("Failed to write Apps & Features value {name}"))?;
    }

    info!("Apps & Features entry registered");
    Ok(())
}

/// Keeps the entry's version current after a platform update; a no-op when the client is not installed.
pub fn refresh(install_path: &Path) {
    if !install_path.exists() {
        return;
    }
    if let Err(e) = register(install_path) {
        warn!("Failed to refresh Apps & Features entry: {:#}", e);
    }
}

/// Removes the entry; succeeds when it does not exist.
pub fn unregister() -> Result<()> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    match hklm.delete_subkey_all(UNINSTALL_KEY) {
        Ok(()) => {
            info!("Apps & Features entry removed");
            Ok(())
        }
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e).context("Failed to remove Apps & Features registry key"),
    }
}

#[cfg(test)]
#[path = "apps_entry_tests.rs"]
mod tests;
