/// OS version and build as the device page shows them; empty when unknown.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct OsVersion {
    pub version: String,
    pub build: String,
}

/// Builds on which `ProductName` still reads "Windows 10" although the OS is Windows 11.
const WINDOWS_11_FIRST_BUILD: u32 = 22000;

/// Reads the running OS version; every failure logs a warning and leaves the field empty.
pub fn detect() -> OsVersion {
    #[cfg(target_os = "macos")]
    {
        macos::detect()
    }
    #[cfg(target_os = "windows")]
    {
        windows::detect()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        OsVersion::default()
    }
}

/// Parses `sw_vers` output into `macOS 15.6.1` / `24G90`.
pub fn parse_sw_vers(output: &str) -> OsVersion {
    let field = |name: &str| {
        output
            .lines()
            .find_map(|line| {
                let (key, value) = line.split_once(':')?;
                (key.trim() == name).then(|| value.trim().to_string())
            })
            .filter(|value| !value.is_empty())
    };

    let name = field("ProductName").unwrap_or_else(|| "macOS".to_string());
    let version = field("ProductVersion")
        .map(|version| match field("ProductVersionExtra") {
            Some(extra) => format!("{name} {version} {extra}"),
            None => format!("{name} {version}"),
        })
        .unwrap_or_default();

    OsVersion {
        version,
        build: field("BuildVersion").unwrap_or_default(),
    }
}

/// Builds `Windows 11 Pro 23H2` / `22631.3007` from the CurrentVersion registry values.
pub fn windows_version(
    product_name: &str,
    display_version: Option<&str>,
    build_number: &str,
    ubr: Option<u32>,
) -> OsVersion {
    let build_number = build_number.trim();
    let mut name = product_name.trim().to_string();
    let is_windows_11 = build_number
        .parse::<u32>()
        .is_ok_and(|build| build >= WINDOWS_11_FIRST_BUILD);
    if let Some(rest) = name.strip_prefix("Windows 10").filter(|_| is_windows_11) {
        name = format!("Windows 11{rest}");
    }

    let version = match display_version.map(str::trim).filter(|d| !d.is_empty()) {
        Some(display) if name.is_empty() => display.to_string(),
        Some(display) => format!("{name} {display}"),
        None => name,
    };
    let build = match ubr {
        Some(ubr) if build_number.is_empty() => ubr.to_string(),
        Some(ubr) => format!("{build_number}.{ubr}"),
        None => build_number.to_string(),
    };

    OsVersion { version, build }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::{parse_sw_vers, OsVersion};
    use std::process::Command;
    use tracing::warn;

    pub(super) fn detect() -> OsVersion {
        let output = match Command::new("/usr/bin/sw_vers").output() {
            Ok(output) if output.status.success() => output,
            Ok(output) => {
                warn!(
                    "sw_vers failed: {}",
                    String::from_utf8_lossy(&output.stderr).trim()
                );
                return OsVersion::default();
            }
            Err(e) => {
                warn!("Failed to run sw_vers: {:#}", e);
                return OsVersion::default();
            }
        };

        let parsed = parse_sw_vers(&String::from_utf8_lossy(&output.stdout));
        if parsed == OsVersion::default() {
            warn!("sw_vers printed no ProductVersion or BuildVersion");
        }
        parsed
    }
}

#[cfg(target_os = "windows")]
mod windows {
    use super::{windows_version, OsVersion};
    use tracing::warn;
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    const CURRENT_VERSION_KEY: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";

    pub(super) fn detect() -> OsVersion {
        let key = match RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(CURRENT_VERSION_KEY) {
            Ok(key) => key,
            Err(e) => {
                warn!("Failed to open HKLM\\{}: {:#}", CURRENT_VERSION_KEY, e);
                return OsVersion::default();
            }
        };

        let product_name = string_value(&key, "ProductName");
        let build_number = string_value(&key, "CurrentBuildNumber");
        // DisplayVersion (e.g. 24H2) exists since 20H2; older installs only carry ReleaseId.
        let display_version: Option<String> = key
            .get_value("DisplayVersion")
            .or_else(|_| key.get_value("ReleaseId"))
            .ok();
        let ubr: Option<u32> = key.get_value("UBR").ok();

        windows_version(
            &product_name,
            display_version.as_deref(),
            &build_number,
            ubr,
        )
    }

    fn string_value(key: &RegKey, name: &str) -> String {
        key.get_value(name).unwrap_or_else(|e| {
            warn!(
                "Failed to read {} from HKLM\\{}: {:#}",
                name, CURRENT_VERSION_KEY, e
            );
            String::new()
        })
    }
}

#[cfg(test)]
#[path = "os_version_tests.rs"]
mod tests;
