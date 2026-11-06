use super::{AppIdentity, MainImages, Undetermined, RESOLVE_TIMEOUT_SECS};
use crate::executor::{execute_script, Privilege, ScriptParams};
use crate::services::package_manager::brew;
use serde::Deserialize;
use std::path::{Path, PathBuf};

const INFO: &str = r#"HOMEBREW_NO_AUTO_UPDATE=1 "$BREW" info --json=v2 --cask "$@"
"#;

const APPLICATIONS: &str = "/Applications";

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

#[derive(Debug, Deserialize)]
struct Info {
    casks: Vec<Cask>,
}

#[derive(Debug, Deserialize)]
struct Cask {
    token: String,
    #[serde(default)]
    full_token: String,
    #[serde(default)]
    old_tokens: Vec<String>,
    installed: Option<String>,
    #[serde(default)]
    artifacts: Vec<serde_json::Map<String, serde_json::Value>>,
}

/// Where brew installed the cask's app.
pub(super) async fn resolve(name: &str) -> Result<AppIdentity, Undetermined> {
    let info = run(&[name.to_string()]).await?;
    info.casks
        .iter()
        .find(|cask| is_named(cask, name))
        .map_or(Err(Undetermined::NotInstalled), |cask| {
            identity(cask, Path::new(APPLICATIONS))
        })
}

async fn run(names: &[String]) -> Result<Info, Undetermined> {
    let result = execute_script(ScriptParams {
        code: &brew::script(INFO),
        shell: "bash",
        args: names,
        timeout_secs: RESOLVE_TIMEOUT_SECS,
        privilege: Privilege::User,
        env_vars: &[],
    })
    .await;
    if result.retcode != 0 {
        return Err(Undetermined::Resolver(format!(
            "exit {}: {}",
            result.retcode,
            result.stderr.trim()
        )));
    }
    let start = result.stdout.find('{').unwrap_or(0);
    serde_json::from_str(&result.stdout[start..])
        .map_err(|e| Undetermined::Resolver(format!("unparseable output: {e}")))
}

/// brew answers an old token or a tap-qualified name with the cask's current token.
fn is_named(cask: &Cask, name: &str) -> bool {
    let short = name.rsplit('/').next().unwrap_or(name);
    cask.full_token == name || cask.token == short || cask.old_tokens.iter().any(|old| old == short)
}

/// The cask's app bundle and main images; NoApp for file-only casks, pkg and script casks unknown.
fn identity(cask: &Cask, applications: &Path) -> Result<AppIdentity, Undetermined> {
    if cask.installed.is_none() {
        return Err(Undetermined::NotInstalled);
    }
    let Some(app) = cask
        .artifacts
        .iter()
        .find(|artifact| artifact.contains_key("app"))
    else {
        // File-only casks hold nothing; a pkg or an installer script is unknown, so it is held.
        let no_app = cask
            .artifacts
            .iter()
            .flat_map(|artifact| artifact.keys())
            .all(|key| NO_APP_KEYS.contains(&key.as_str()));
        return if no_app {
            Ok(AppIdentity::NoApp)
        } else {
            Err(Undetermined::NoInstallLocation)
        };
    };
    // Where brew put the bundle (target, Homebrew 7), else <applications>/<App>.app.
    let install_dir: PathBuf = match app.get("target").and_then(|target| target.as_str()) {
        Some(target) => PathBuf::from(target),
        None => applications.join(
            app.get("app")
                .and_then(|names| names.as_array()?.first()?.as_str())
                .ok_or(Undetermined::NoInstallLocation)?,
        ),
    };

    // Main images sit directly in Contents/MacOS; nested helper bundles never match.
    let mut names: Vec<String> = std::fs::read_dir(install_dir.join("Contents").join("MacOS"))
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| entry.file_type().is_ok_and(|t| t.is_file()))
                .map(|entry| entry.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default();
    names.sort();

    let main_images = if names.is_empty() {
        MainImages::Unknown
    } else {
        MainImages::Derived(names)
    };
    Ok(AppIdentity::App {
        install_dir,
        main_images,
    })
}

#[cfg(test)]
#[path = "brew_tests.rs"]
mod tests;
