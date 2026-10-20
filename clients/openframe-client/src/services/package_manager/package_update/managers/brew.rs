use serde::Deserialize;

use super::{
    last_line, OutdatedPackage, QueryError, UpgradeOutcome, OUTDATED_TIMEOUT_SECS,
    UPGRADE_TIMEOUT_SECS,
};
use crate::executor::{execute_script, ExecResult, Privilege, ScriptParams};
use crate::models::{BrewKind, PackageRef};
use crate::services::package_manager::brew;

/// `brew update` first: without it `outdated` compares against stale tap metadata.
const OUTDATED: &str = r#""$BREW" update >/dev/null
HOMEBREW_NO_AUTO_UPDATE=1 "$BREW" outdated --json=v2
"#;

const UPGRADE: &str = r#"NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 "$BREW" upgrade "$@"
"#;

const COULD_NOT_LAUNCH: i32 = 85;

#[derive(Deserialize)]
struct Outdated {
    #[serde(default)]
    formulae: Vec<Entry>,
    #[serde(default)]
    casks: Vec<Entry>,
}

#[derive(Deserialize)]
struct Entry {
    name: String,
    #[serde(default)]
    installed_versions: Vec<String>,
    #[serde(default)]
    current_version: Option<String>,
}

pub(super) async fn outdated() -> Result<Vec<OutdatedPackage>, QueryError> {
    let result = execute_script(ScriptParams {
        code: &brew::script(OUTDATED),
        shell: "bash",
        args: &[],
        timeout_secs: OUTDATED_TIMEOUT_SECS,
        privilege: Privilege::User,
        env_vars: &[],
    })
    .await;
    if result.retcode != 0 {
        return Err(QueryError::Failed(format!(
            "outdated query exited {}: {}",
            result.retcode,
            result.stderr.trim()
        )));
    }
    parse_outdated(&result.stdout).map_err(QueryError::Failed)
}

pub(super) async fn upgrade(package: &PackageRef) -> UpgradeOutcome {
    let PackageRef::Brew { kind, name } = package else {
        return UpgradeOutcome::Failed {
            exit_code: 0,
            message: format!("not a brew package: {package:?}"),
        };
    };
    let flag = match kind {
        BrewKind::Formula => "--formula",
        BrewKind::Cask => "--cask",
    };
    let args = [flag.to_string(), name.clone()];
    let result = execute_script(ScriptParams {
        code: &brew::script(UPGRADE),
        shell: "bash",
        args: &args,
        timeout_secs: UPGRADE_TIMEOUT_SECS,
        privilege: Privilege::User,
        env_vars: &[],
    })
    .await;
    interpret(&result)
}

fn parse_outdated(stdout: &str) -> Result<Vec<OutdatedPackage>, String> {
    let start = stdout
        .find('{')
        .ok_or_else(|| "no JSON in the outdated query output".to_string())?;
    let outdated: Outdated = serde_json::from_str(&stdout[start..])
        .map_err(|e| format!("unparseable outdated query output: {e}"))?;
    let entry = |kind: BrewKind| {
        move |entry: Entry| OutdatedPackage {
            package: PackageRef::Brew {
                kind,
                name: entry.name,
            },
            installed_version: entry.installed_versions.into_iter().last(),
            available_version: entry.current_version.filter(|v| !v.is_empty()),
        }
    };
    let formulae = outdated.formulae.into_iter().map(entry(BrewKind::Formula));
    let casks = outdated.casks.into_iter().map(entry(BrewKind::Cask));
    Ok(formulae.chain(casks).collect())
}

fn interpret(result: &ExecResult) -> UpgradeOutcome {
    if result.timed_out {
        return UpgradeOutcome::TimedOut;
    }
    match result.retcode {
        0 if is_already_latest(result) => UpgradeOutcome::AlreadyLatest,
        0 => UpgradeOutcome::Upgraded {
            reboot_required: false,
        },
        COULD_NOT_LAUNCH => UpgradeOutcome::Busy(format!(
            "could not run as the console user: {}",
            result.stderr.trim()
        )),
        code => UpgradeOutcome::Failed {
            exit_code: i64::from(code),
            message: format!("brew exited {code}: {}", last_line(&result.stderr)),
        },
    }
}

/// brew exits 0 with a warning when nothing was upgraded; an actual upgrade announces itself.
fn is_already_latest(result: &ExecResult) -> bool {
    let output = format!("{}\n{}", result.stdout, result.stderr);
    !output.contains("==> Upgrading") && output.contains("already installed")
}

#[cfg(test)]
#[path = "brew_tests.rs"]
mod tests;
