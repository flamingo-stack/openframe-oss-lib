use serde::Deserialize;
use std::path::{Path, PathBuf};

/// Apple silicon first, then Intel.
pub(crate) const PATHS: [&str; 2] = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];

pub(crate) const APPLICATIONS: &str = "/Applications";

pub(crate) const COULD_NOT_LAUNCH: i32 = 85;

pub(crate) const CASK_INFO: &str = r#"HOMEBREW_NO_AUTO_UPDATE=1 "$BREW" info --json=v2 --cask "$@"
"#;

/// Artifact keys that place no app: links, wrappers, fonts, man pages, completions, bookkeeping.
const NO_APP_KEYS: &[&str] = &[
    "binary",
    "command_wrapper",
    "manpage",
    "font",
    "bash_completion",
    "zsh_completion",
    "fish_completion",
    "pwsh_completion",
    "generate_completions_from_executable",
    "target",
    "uninstall",
    "zap",
    "preflight",
    "postflight",
    "uninstall_preflight",
    "uninstall_postflight",
    "preflight_steps",
    "postflight_steps",
];

/// A bash script that runs `body` with `$BREW` set to the first executable of [`PATHS`].
pub(crate) fn script(body: &str) -> String {
    format!(
        "#!/bin/bash\nset -euo pipefail\nfor BREW in {}; do if [ -x \"$BREW\" ]; then break; fi; done\n{body}",
        PATHS.join(" ")
    )
}

#[derive(Debug, Deserialize)]
pub(crate) struct CaskInfo {
    pub(crate) casks: Vec<Cask>,
}

impl CaskInfo {
    pub(crate) fn from_output(stdout: &str) -> serde_json::Result<Self> {
        let start = stdout.find('{').unwrap_or(0);
        serde_json::from_str(&stdout[start..])
    }
}

#[derive(Debug, Deserialize)]
pub(crate) struct Cask {
    token: String,
    #[serde(default)]
    full_token: String,
    #[serde(default)]
    old_tokens: Vec<String>,
    pub(crate) installed: Option<String>,
    #[serde(default)]
    artifacts: Vec<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum CaskApp {
    Bundle(PathBuf),
    NoApp,
    Unknown,
}

impl Cask {
    /// brew answers an old token or a tap-qualified name with the cask's current token.
    pub(crate) fn is_named(&self, name: &str) -> bool {
        let short = name.rsplit('/').next().unwrap_or(name);
        self.full_token == name
            || self.token == short
            || self.old_tokens.iter().any(|old| old == short)
    }

    pub(crate) fn installs_pkg(&self) -> bool {
        self.artifacts
            .iter()
            .any(|artifact| artifact.contains_key("pkg"))
    }

    pub(crate) fn app(&self, applications: &Path) -> CaskApp {
        let Some(app) = self
            .artifacts
            .iter()
            .find(|artifact| artifact.contains_key("app"))
        else {
            let no_app = self
                .artifacts
                .iter()
                .flat_map(|artifact| artifact.keys())
                .all(|key| NO_APP_KEYS.contains(&key.as_str()));
            return if no_app {
                CaskApp::NoApp
            } else {
                CaskApp::Unknown
            };
        };
        // Where brew puts the bundle (target, Homebrew 7), else <applications>/<App>.app.
        match app.get("target").and_then(|target| target.as_str()) {
            Some(target) => CaskApp::Bundle(PathBuf::from(target)),
            None => app
                .get("app")
                .and_then(|names| names.as_array()?.first()?.as_str())
                .map_or(CaskApp::Unknown, |name| {
                    CaskApp::Bundle(applications.join(name))
                }),
        }
    }
}

#[cfg(test)]
#[path = "brew_tests.rs"]
mod tests;
