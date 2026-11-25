use std::sync::OnceLock;

use tracing::info;

use crate::models::OsVersionNumber;

/// OS version and build; empty when unknown.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct OsVersion {
    pub version: Option<OsVersionNumber>,
    pub build: String,
}

pub fn current() -> &'static OsVersion {
    static CURRENT: OnceLock<OsVersion> = OnceLock::new();
    CURRENT.get_or_init(|| {
        let detected = detect();
        info!(
            version = ?detected.version.as_ref().map(ToString::to_string),
            build = %detected.build,
            "Resolved OS version"
        );
        detected
    })
}

/// Reads the running OS version; every failure logs a warning and leaves the field empty.
fn detect() -> OsVersion {
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

/// Parses `sw_vers` output into `15.6.1` / `24G90`.
#[cfg(any(target_os = "macos", test))]
fn parse_sw_vers(output: &str) -> OsVersion {
    let field = |name: &str| {
        output
            .lines()
            .find_map(|line| {
                let (key, value) = line.split_once(':')?;
                (key.trim() == name).then(|| value.trim().to_string())
            })
            .filter(|value| !value.is_empty())
    };

    OsVersion {
        version: field("ProductVersion").and_then(|version| version.parse().ok()),
        build: field("BuildVersion").unwrap_or_default(),
    }
}

/// Builds `10.0.22631` / `22631.3007` from the CurrentVersion registry values.
#[cfg(any(target_os = "windows", test))]
fn windows_version(
    kernel_version: Option<(u32, u32)>,
    build_number: &str,
    ubr: Option<u32>,
) -> OsVersion {
    let build_number = build_number.trim();
    let version = kernel_version
        .and_then(|(major, minor)| format!("{major}.{minor}.{build_number}").parse().ok());
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

        let build_number: String = key.get_value("CurrentBuildNumber").unwrap_or_else(|e| {
            warn!(
                "Failed to read CurrentBuildNumber from HKLM\\{}: {:#}",
                CURRENT_VERSION_KEY, e
            );
            String::new()
        });
        let ubr: Option<u32> = key.get_value("UBR").ok();
        let major: Option<u32> = key.get_value("CurrentMajorVersionNumber").ok();
        let minor: Option<u32> = key.get_value("CurrentMinorVersionNumber").ok();

        windows_version(major.zip(minor), &build_number, ubr)
    }
}

#[cfg(test)]
#[path = "os_version_tests.rs"]
mod tests;
