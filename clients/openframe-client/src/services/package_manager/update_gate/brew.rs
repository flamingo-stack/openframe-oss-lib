use super::{AppIdentity, MainImages, Undetermined, RESOLVE_TIMEOUT_SECS};
use crate::executor::{execute_script, Privilege, ScriptParams};
use crate::models::{BrewKind, PackageRef};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const INFO_SCRIPT: &str = r#"#!/bin/bash
set -euo pipefail

if [ -x /opt/homebrew/bin/brew ]; then
  BREW=/opt/homebrew/bin/brew
elif [ -x /usr/local/bin/brew ]; then
  BREW=/usr/local/bin/brew
else
  BREW=brew
fi

HOMEBREW_NO_AUTO_UPDATE=1 "$BREW" info --json=v2 --cask "$@"
"#;

const APPLICATIONS: &str = "/Applications";

#[derive(Debug, Deserialize)]
struct Info {
    casks: Vec<Cask>,
}

#[derive(Debug, Deserialize)]
struct Cask {
    token: String,
    installed: Option<String>,
    #[serde(default)]
    artifacts: Vec<serde_json::Value>,
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
        code: INFO_SCRIPT,
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

/// The main images are what sits directly in `<App>.app/Contents/MacOS`; nested helper
/// bundles live elsewhere in the bundle and never match.
fn identity(cask: &Cask, applications: &Path) -> Result<AppIdentity, Undetermined> {
    if cask.installed.is_none() {
        return Err(Undetermined::NotInstalled);
    }
    let app = cask
        .artifacts
        .iter()
        .find_map(|artifact| artifact.get("app")?.as_array()?.first()?.as_str())
        .ok_or(Undetermined::NoInstallLocation)?;
    let install_dir: PathBuf = applications.join(app);

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
