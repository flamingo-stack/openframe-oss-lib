use super::download_configuration::DownloadConfiguration;
use super::tool_version_overrides;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ToolInstallationMessage {
    pub tool_agent_id: String,
    pub tool_id: String,
    pub tool_type: String,
    pub version: String,
    pub reinstall: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub download_configurations: Option<Vec<DownloadConfiguration>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installation_command_args: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uninstallation_command_args: Option<Vec<String>>,
    pub run_command_args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_agent_id_command_args: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<Vec<Asset>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_name: Option<String>,
}

impl ToolInstallationMessage {
    pub fn effective_version(&self) -> &str {
        tool_version_overrides::lookup(&self.tool_id).unwrap_or(&self.version)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub local_filename_configuration: Vec<LocalFilenameConfig>,
    pub source: AssetSource,
    pub path: Option<String>,
    #[serde(default)]
    pub executable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub download_configurations: Option<Vec<DownloadConfiguration>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

impl Asset {
    pub fn original_version(&self) -> &str {
        self.version.as_deref().unwrap_or("")
    }

    pub fn effective_version(&self) -> &str {
        tool_version_overrides::lookup(&self.id).unwrap_or_else(|| self.original_version())
    }
}

fn current_os_str() -> Option<&'static str> {
    if cfg!(target_os = "windows") {
        Some("windows")
    } else if cfg!(target_os = "macos") {
        Some("macos")
    } else if cfg!(target_os = "linux") {
        Some("linux")
    } else {
        None
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalFilenameConfig {
    pub filename: String,
    pub os: String,
}

impl LocalFilenameConfig {
    pub fn matches_current_os(&self) -> bool {
        match current_os_str() {
            Some(current_os) => self.os.eq_ignore_ascii_case(current_os),
            None => false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum AssetSource {
    #[serde(rename = "ARTIFACTORY")]
    Artifactory,
    #[serde(rename = "TOOL_API")]
    ToolApi,
    #[serde(rename = "GITHUB")]
    Github,
}
