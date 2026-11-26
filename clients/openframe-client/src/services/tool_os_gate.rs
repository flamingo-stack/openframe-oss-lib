use crate::models::download_configuration::DownloadConfiguration;
use crate::models::OsVersionNumber;

#[derive(Debug, PartialEq, Eq)]
pub enum ToolChange {
    Done,
    NotSupported(String),
}

pub fn os_version_shortfall(
    configs: &[DownloadConfiguration],
    current: Option<&OsVersionNumber>,
) -> Option<String> {
    let (config, minimum) = configs
        .iter()
        .filter(|c| c.matches_current_os())
        .find_map(|c| Some((c, c.min_os_version.as_ref()?)))?;
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

#[cfg(test)]
#[path = "tool_os_gate_tests.rs"]
mod tests;
