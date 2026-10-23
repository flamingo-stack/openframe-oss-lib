#[cfg(any(target_os = "macos", windows))]
use tracing::warn;

/// OS version label and build identifier in Fleet's `os_version` / `build` shape; `None` when unknown.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct OsVersion {
    pub version: Option<String>,
    pub build: Option<String>,
}

pub fn detect() -> OsVersion {
    #[cfg(target_os = "macos")]
    {
        OsVersion {
            version: sw_vers("-productVersion").map(|v| format!("macOS {}", v)),
            build: sw_vers("-buildVersion"),
        }
    }
    #[cfg(windows)]
    {
        detect_windows().unwrap_or_else(|e| {
            warn!(
                "Failed to read the Windows version from the registry: {:#}",
                e
            );
            OsVersion::default()
        })
    }
    #[cfg(not(any(target_os = "macos", windows)))]
    {
        OsVersion::default()
    }
}

#[cfg(target_os = "macos")]
fn sw_vers(flag: &str) -> Option<String> {
    let output = std::process::Command::new("/usr/bin/sw_vers")
        .arg(flag)
        .output()
        .map_err(|e| warn!("Failed to run sw_vers {}: {:#}", flag, e))
        .ok()?;
    if !output.status.success() {
        warn!(
            "sw_vers {} failed: {}",
            flag,
            String::from_utf8_lossy(&output.stderr).trim()
        );
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!value.is_empty()).then_some(value)
}

#[cfg(windows)]
fn detect_windows() -> anyhow::Result<OsVersion> {
    use anyhow::Context;
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion")
        .context("Failed to open the CurrentVersion registry key")?;
    let product_name: String = key
        .get_value("ProductName")
        .context("Failed to read ProductName")?;
    let build: String = key
        .get_value("CurrentBuildNumber")
        .context("Failed to read CurrentBuildNumber")?;
    // DisplayVersion (e.g. 24H2) exists since 20H2; older builds only have ReleaseId (e.g. 1909).
    let display_version: Option<String> = key
        .get_value("DisplayVersion")
        .or_else(|_| key.get_value("ReleaseId"))
        .ok();
    let ubr: Option<u32> = key.get_value("UBR").ok();

    Ok(OsVersion {
        version: Some(windows_version(
            &product_name,
            display_version.as_deref(),
            &build,
        )),
        build: Some(windows_build(&build, ubr)),
    })
}

// Windows 11 still reports "Windows 10 ..." in ProductName; builds from 22000 are Windows 11.
#[cfg(any(windows, test))]
fn windows_version(product_name: &str, display_version: Option<&str>, build: &str) -> String {
    let is_windows_11 = build.parse::<u32>().is_ok_and(|b| b >= 22000);
    let name = if is_windows_11 {
        product_name.replacen("Windows 10", "Windows 11", 1)
    } else {
        product_name.to_string()
    };
    match display_version.map(str::trim) {
        Some(dv) if !dv.is_empty() => format!("{} {}", name.trim(), dv),
        _ => name.trim().to_string(),
    }
}

#[cfg(any(windows, test))]
fn windows_build(build: &str, ubr: Option<u32>) -> String {
    match ubr {
        Some(ubr) => format!("{}.{}", build, ubr),
        None => build.to_string(),
    }
}

#[cfg(test)]
#[path = "os_version_tests.rs"]
mod tests;
