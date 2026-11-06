use serde::Deserialize;

use super::{
    last_line, Probe, ProbeState, QueryError, UpgradeOutcome, PROBE_TIMEOUT_SECS,
    UPGRADE_TIMEOUT_SECS,
};
use crate::executor::{execute_script, ExecResult, Privilege, ScriptParams};
use crate::models::{BrewKind, PackageRef};
use crate::services::package_manager::brew;

/// `brew update` first: without it `info` compares against stale tap metadata.
const INFO: &str = r#""$BREW" update >/dev/null
HOMEBREW_NO_AUTO_UPDATE=1 "$BREW" info --json=v2 "$@"
"#;

/// After an upgrade: the tap metadata is the one the upgrade used, only the installed version moved.
const INSTALLED_INFO: &str = r#"HOMEBREW_NO_AUTO_UPDATE=1 "$BREW" info --json=v2 "$@"
"#;

const UPGRADE: &str = r#"NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 "$BREW" upgrade "$@"
"#;

const COULD_NOT_LAUNCH: i32 = 85;

#[derive(Deserialize)]
struct Info {
    #[serde(default)]
    formulae: Vec<Formula>,
    #[serde(default)]
    casks: Vec<Cask>,
}

#[derive(Deserialize)]
struct Formula {
    #[serde(default)]
    installed: Vec<Keg>,
    versions: Versions,
    #[serde(default)]
    outdated: bool,
    #[serde(default)]
    pinned: bool,
    #[serde(default)]
    disabled: bool,
}

#[derive(Deserialize)]
struct Keg {
    version: String,
}

#[derive(Deserialize)]
struct Versions {
    stable: Option<String>,
}

#[derive(Deserialize)]
struct Cask {
    installed: Option<String>,
    version: Option<String>,
    #[serde(default)]
    outdated: bool,
    #[serde(default)]
    pinned: bool,
    #[serde(default)]
    disabled: bool,
}

pub(super) async fn probe(package: &PackageRef) -> Result<Probe, QueryError> {
    info(package, INFO).await
}

pub(super) async fn reread(package: &PackageRef) -> Result<Probe, QueryError> {
    info(package, INSTALLED_INFO).await
}

async fn info(package: &PackageRef, script: &str) -> Result<Probe, QueryError> {
    let Some(args) = args(package) else {
        return Err(QueryError::Unavailable(format!(
            "not a brew package: {package:?}"
        )));
    };
    let result = execute_script(ScriptParams {
        code: &brew::script(script),
        shell: "bash",
        args: &args,
        timeout_secs: PROBE_TIMEOUT_SECS,
        privilege: Privilege::User,
        env_vars: &[],
    })
    .await;
    if result.retcode != 0 {
        return Err(QueryError::Failed(format!(
            "brew info exited {}: {}",
            result.retcode,
            result.stderr.trim()
        )));
    }
    read_info(&result.stdout).map_err(QueryError::Failed)
}

pub(super) async fn upgrade(package: &PackageRef) -> UpgradeOutcome {
    let Some(args) = args(package) else {
        return UpgradeOutcome::Failed {
            exit_code: 0,
            message: format!("not a brew package: {package:?}"),
        };
    };
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

/// `--formula|--cask <name>`, the namespace brew looks the package up in.
fn args(package: &PackageRef) -> Option<[String; 2]> {
    let PackageRef::Brew { kind, name } = package else {
        return None;
    };
    let flag = match kind {
        BrewKind::Formula => "--formula",
        BrewKind::Cask => "--cask",
    };
    Some([flag.to_string(), name.clone()])
}

fn read_info(stdout: &str) -> Result<Probe, String> {
    let start = stdout
        .find('{')
        .ok_or_else(|| "no JSON in the brew info output".to_string())?;
    let info: Info = serde_json::from_str(&stdout[start..])
        .map_err(|e| format!("unparseable brew info output: {e}"))?;
    if let Some(formula) = info.formulae.into_iter().next() {
        let installed_version = formula.installed.into_iter().last().map(|keg| keg.version);
        let state = state_of(
            installed_version.is_some(),
            formula.outdated,
            formula.pinned,
            formula.disabled,
        );
        return Ok(Probe {
            state,
            installed_version,
            available_version: formula.versions.stable,
        });
    }
    let cask = info
        .casks
        .into_iter()
        .next()
        .ok_or_else(|| "brew info named no package".to_string())?;
    let state = state_of(
        cask.installed.is_some(),
        cask.outdated,
        cask.pinned,
        cask.disabled,
    );
    Ok(Probe {
        state,
        installed_version: cask.installed,
        available_version: cask.version,
    })
}

/// What brew does with an installed package: pinned and disabled ones it leaves alone.
fn state_of(installed: bool, outdated: bool, pinned: bool, disabled: bool) -> ProbeState {
    match (installed, outdated) {
        (false, _) => ProbeState::NotInstalled,
        (true, false) => ProbeState::UpToDate,
        (true, true) if pinned => ProbeState::NotUpgradable("pinned with brew pin".to_string()),
        (true, true) if disabled => ProbeState::NotUpgradable("disabled in Homebrew".to_string()),
        (true, true) => ProbeState::Outdated,
    }
}

fn interpret(result: &ExecResult) -> UpgradeOutcome {
    if result.timed_out {
        return UpgradeOutcome::TimedOut;
    }
    match result.retcode {
        0 => skipped(result).unwrap_or(UpgradeOutcome::Upgraded {
            reboot_required: false,
        }),
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

/// brew exits 0 with a warning also when it upgraded nothing; an actual upgrade announces itself.
fn skipped(result: &ExecResult) -> Option<UpgradeOutcome> {
    let output = format!("{}\n{}", result.stdout, result.stderr);
    if output.contains("==> Upgrading") {
        return None;
    }
    if let Some(line) = output.lines().find(|line| line.contains("Not upgrading")) {
        let line = line.trim().trim_start_matches("Warning: ");
        return Some(
            if line.contains("already installed") || line.contains("has not changed") {
                UpgradeOutcome::AlreadyLatest
            } else {
                UpgradeOutcome::NotUpgradable(line.to_string())
            },
        );
    }
    output
        .contains("already installed")
        .then_some(UpgradeOutcome::AlreadyLatest)
}

#[cfg(test)]
#[path = "brew_tests.rs"]
mod tests;
