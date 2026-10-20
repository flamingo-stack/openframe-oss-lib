use serde::Deserialize;

use super::{last_line, QueryError, UpgradeOutcome, OUTDATED_TIMEOUT_SECS, UPGRADE_TIMEOUT_SECS};
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
    formulae: Vec<Named>,
    #[serde(default)]
    casks: Vec<Named>,
}

#[derive(Deserialize)]
struct Named {
    name: String,
}

pub(super) async fn outdated() -> Result<Vec<PackageRef>, QueryError> {
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
        return UpgradeOutcome::Failed(format!("not a brew package: {package:?}"));
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

fn parse_outdated(stdout: &str) -> Result<Vec<PackageRef>, String> {
    let start = stdout
        .find('{')
        .ok_or_else(|| "no JSON in the outdated query output".to_string())?;
    let outdated: Outdated = serde_json::from_str(&stdout[start..])
        .map_err(|e| format!("unparseable outdated query output: {e}"))?;
    let formulae = outdated.formulae.into_iter().map(|f| PackageRef::Brew {
        kind: BrewKind::Formula,
        name: f.name,
    });
    let casks = outdated.casks.into_iter().map(|c| PackageRef::Brew {
        kind: BrewKind::Cask,
        name: c.name,
    });
    Ok(formulae.chain(casks).collect())
}

fn interpret(result: &ExecResult) -> UpgradeOutcome {
    if result.timed_out {
        return UpgradeOutcome::Failed("timed out".to_string());
    }
    match result.retcode {
        0 => UpgradeOutcome::Upgraded,
        COULD_NOT_LAUNCH => UpgradeOutcome::Deferred(format!(
            "could not run as the console user: {}",
            result.stderr.trim()
        )),
        code => {
            UpgradeOutcome::Failed(format!("brew exited {code}: {}", last_line(&result.stderr)))
        }
    }
}

#[cfg(test)]
#[path = "brew_tests.rs"]
mod tests;
