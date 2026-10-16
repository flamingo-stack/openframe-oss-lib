use super::{AppIdentity, MainImages, Undetermined, RESOLVE_TIMEOUT_SECS};
use crate::executor::{execute_script, Privilege, ScriptParams};
use crate::models::{BrewKind, PackageRef};
use crate::services::package_manager::brew;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const INFO: &str = r#"HOMEBREW_NO_AUTO_UPDATE=1 "$BREW" info --json=v2 --cask "$@"
"#;

const APPLICATIONS: &str = "/Applications";

/// Artifact keys that put no app in place: command-line links and wrappers, fonts, man pages,
/// completions, and the install and uninstall bookkeeping around them.
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
    installed: Option<String>,
    #[serde(default)]
    artifacts: Vec<serde_json::Map<String, serde_json::Value>>,
}

/// An entry for every cask in `packages`; one `brew info` run for all of them.
pub(super) async fn resolve(
    packages: &[PackageRef],
) -> HashMap<PackageRef, Result<AppIdentity, Undetermined>> {
    let names: Vec<String> = packages
        .iter()
        .filter_map(|package| match package {
            PackageRef::Brew {
                kind: BrewKind::Cask,
                name,
            } => Some(name.clone()),
            _ => None,
        })
        .collect();
    if names.is_empty() {
        return HashMap::new();
    }

    let info = run(&names).await;
    names
        .into_iter()
        .map(|name| {
            let identity = info.as_ref().map_err(Clone::clone).and_then(|info| {
                info.casks
                    .iter()
                    .find(|cask| cask.token == name)
                    .map_or(Err(Undetermined::NotInstalled), |cask| {
                        identity(cask, Path::new(APPLICATIONS))
                    })
            });
            let package = PackageRef::Brew {
                kind: BrewKind::Cask,
                name,
            };
            (package, identity)
        })
        .collect()
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

/// The app's bundle is where brew put it (`target`, Homebrew 7), else `<applications>/<App>.app`.
/// A cask without an app holds nothing when it only places files that do not run as an app;
/// anything else it installs (a pkg, an installer script) is not known, so it is held.
/// The main images are what sits directly in `<App>.app/Contents/MacOS`; nested helper
/// bundles live elsewhere in the bundle and never match.
fn identity(cask: &Cask, applications: &Path) -> Result<AppIdentity, Undetermined> {
    if cask.installed.is_none() {
        return Err(Undetermined::NotInstalled);
    }
    let Some(app) = cask
        .artifacts
        .iter()
        .find(|artifact| artifact.contains_key("app"))
    else {
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
    let install_dir: PathBuf = match app.get("target").and_then(|target| target.as_str()) {
        Some(target) => PathBuf::from(target),
        None => applications.join(
            app.get("app")
                .and_then(|names| names.as_array()?.first()?.as_str())
                .ok_or(Undetermined::NoInstallLocation)?,
        ),
    };

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
