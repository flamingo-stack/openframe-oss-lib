use serde::{Deserialize, Serialize};
use std::path::Path;

use super::OsVersionNumber;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InstallationType {
    #[default]
    Standard,
    GuiApp,
    Service,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadConfiguration {
    pub os: String,
    pub file_name: String,
    #[serde(alias = "agentFileName", alias = "assetFileName")]
    pub target_file_name: String,
    pub link: String,
    #[serde(default)]
    pub installation_type: InstallationType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bundle_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_os_version: Option<OsVersionNumber>,
}

pub fn os_version_shortfall(
    configs: &[DownloadConfiguration],
    current: Option<&OsVersionNumber>,
) -> Option<String> {
    let config = configs.iter().find(|c| c.matches_current_os())?;
    let minimum = config.min_os_version.as_ref()?;
    let current = current?;
    (current < minimum).then(|| {
        let os = match config.os.to_ascii_lowercase().as_str() {
            "macos" => "macOS",
            "windows" => "Windows",
            "linux" => "Linux",
            _ => config.os.as_str(),
        };
        format!("needs {os} {minimum} or later, this device runs {current}")
    })
}

impl DownloadConfiguration {
    /// Returns true if agent_file_name is a path (requires extracting entire archive).
    pub fn is_folder_extraction(&self) -> bool {
        Path::new(&self.target_file_name).components().count() > 1
    }

    pub fn with_version_override(&self, original: &str, override_version: &str) -> Self {
        let mut resolved = self.clone();
        if !original.is_empty() && original != override_version {
            let new_link = resolved.link.replace(original, override_version);
            if new_link == resolved.link {
                tracing::warn!(
                    "Version override requested ({} -> {}) but link did not contain the original version: {}",
                    original, override_version, resolved.link
                );
            }
            resolved.link = new_link;
        }
        resolved
    }

    /// Checks if this configuration matches the current OS
    pub fn matches_current_os(&self) -> bool {
        let current_os = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else if cfg!(target_os = "linux") {
            "linux"
        } else {
            return false;
        };

        self.os.eq_ignore_ascii_case(current_os)
    }
}

#[cfg(test)]
#[path = "download_configuration_tests.rs"]
mod tests;
