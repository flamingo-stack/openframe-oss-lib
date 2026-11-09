use serde::Deserialize;
use std::cmp::Ordering;

use super::{last_line, Probe, ProbeState, QueryError, UpgradeOutcome, PROBE_TIMEOUT_SECS};
use crate::executor::{execute_script, ExecResult, Privilege, ScriptParams};
use crate::models::PackageRef;
use crate::services::package_manager::choco::{root, SCRIPT_PRELUDE};
use crate::services::package_manager::update_gate;

const PROBE_SCRIPT: &str = r#"$id = $args[1]
$list = Invoke-Choco list --exact $id --limit-output
if ($list.exit -notin 0, 2) { exit 4 }
$rows = @($list.output | Where-Object { ([string]$_ -split '\|')[0] -eq $id })
$installed = ''
$upgrade = ''
if ($rows.Count -gt 0) {
    $installed = [string]$rows[0]
    $run = Invoke-Choco upgrade $id --noop -y --limit-output "--source=$($args[2])"
    if ($run.exit -notin 0, 2) { exit 5 }
    $rows = @($run.output | Where-Object { ([string]$_ -split '\|')[0] -eq $id })
    if ($rows.Count -gt 0) { $upgrade = [string]$rows[-1] }
}
ConvertTo-Json -Compress -InputObject @{ installed = $installed; upgrade = $upgrade }
"#;

const UPGRADE_SCRIPT: &str = r#"$ErrorActionPreference = 'Continue'
$global:LASTEXITCODE = 1
& $choco upgrade $args[1] "--source=$($args[2])" -y --no-progress --fail-on-not-installed --execution-timeout=540
exit $LASTEXITCODE
"#;

const UPGRADE_TIMEOUT_SECS: u32 = 570;

const NOTHING_TO_DO: i32 = 2;
const PENDING_REBOOT: i32 = 350;
const REBOOT_INITIATED: i32 = 1641;
const INSTALL_SUSPENDED: i32 = 1604;
const MSI_INSTALL_ALREADY_RUNNING: i32 = 1618;
const REBOOT_REQUIRED: i32 = 3010;

#[derive(Deserialize)]
struct Output {
    installed: String,
    upgrade: String,
}

pub(super) async fn probe(package: &PackageRef) -> Result<Probe, QueryError> {
    let PackageRef::Choco { id, feed } = package else {
        return Err(QueryError::Unavailable(format!(
            "not a choco package: {package:?}"
        )));
    };
    let result = execute_script(ScriptParams {
        code: &format!("{SCRIPT_PRELUDE}{PROBE_SCRIPT}"),
        shell: "powershell",
        args: &[root(), id.clone(), feed.clone()],
        timeout_secs: PROBE_TIMEOUT_SECS,
        privilege: Privilege::Agent,
        env_vars: &[],
    })
    .await;
    read_probe(&result)
}

pub(super) async fn upgrade(package: &PackageRef) -> UpgradeOutcome {
    let PackageRef::Choco { id, feed } = package else {
        return UpgradeOutcome::Failed {
            exit_code: 0,
            message: format!("not a choco package: {package:?}"),
        };
    };
    match update_gate::snapshot().await {
        Ok(processes) if processes.iter().any(|process| is_choco(&process.image)) => {
            return UpgradeOutcome::Busy("another Chocolatey run is in progress".to_string())
        }
        Ok(_) => {}
        Err(e) => {
            return UpgradeOutcome::Busy(format!("could not check for a running Chocolatey: {e}"))
        }
    }
    let result = execute_script(ScriptParams {
        code: &format!("{SCRIPT_PRELUDE}{UPGRADE_SCRIPT}"),
        shell: "powershell",
        args: &[root(), id.clone(), feed.clone()],
        timeout_secs: UPGRADE_TIMEOUT_SECS,
        privilege: Privilege::Agent,
        env_vars: &[],
    })
    .await;
    interpret(&result)
}

fn is_choco(image: &std::path::Path) -> bool {
    image
        .file_name()
        .is_some_and(|name| name.eq_ignore_ascii_case("choco.exe"))
}

fn read_probe(result: &ExecResult) -> Result<Probe, QueryError> {
    if result.timed_out {
        return Err(QueryError::Failed("package query timed out".to_string()));
    }
    if result.retcode != 0 {
        return Err(QueryError::Failed(format!(
            "package query exited {}: {}",
            result.retcode,
            result.stderr.trim()
        )));
    }
    let output: Output = serde_json::from_str(result.stdout.trim())
        .map_err(|e| QueryError::Failed(format!("unparseable package query output: {e}")))?;
    let Some(installed) = output
        .installed
        .split('|')
        .nth(1)
        .filter(|version| !version.is_empty())
    else {
        return Ok(Probe {
            state: ProbeState::NotInstalled,
            installed_version: None,
            available_version: None,
        });
    };
    let (state, available) = match output.upgrade.split('|').collect::<Vec<_>>().as_slice() {
        [_, _, available, pinned] => {
            let state = if version_order(installed, available) != Some(Ordering::Less) {
                ProbeState::UpToDate
            } else if *pinned == "true" {
                ProbeState::NotUpgradable("it is pinned in Chocolatey".to_string())
            } else {
                ProbeState::Outdated
            };
            (state, Some(available.to_string()))
        }
        [_, _, _] => (
            ProbeState::NotUpgradable("the feed has no newer version of it".to_string()),
            None,
        ),
        _ => {
            return Err(QueryError::Failed(format!(
                "unexpected upgrade check output: {:?}",
                output.upgrade
            )))
        }
    };
    Ok(Probe {
        state,
        installed_version: Some(installed.to_string()),
        available_version: available,
    })
}

fn version_order(a: &str, b: &str) -> Option<Ordering> {
    fn parse(version: &str) -> Option<(Vec<u64>, Option<String>)> {
        let version = version.trim().split('+').next()?;
        let (release, prerelease) = match version.split_once('-') {
            Some((release, prerelease)) => (release, Some(prerelease.to_ascii_lowercase())),
            None => (version, None),
        };
        let mut parts = release
            .split('.')
            .map(|part| part.parse().ok())
            .collect::<Option<Vec<u64>>>()?;
        if parts.len() < 4 {
            parts.resize(4, 0);
        }
        Some((parts, prerelease))
    }
    let (a_release, a_pre) = parse(a)?;
    let (b_release, b_pre) = parse(b)?;
    Some(
        a_release
            .cmp(&b_release)
            .then_with(|| match (a_pre, b_pre) {
                (None, None) => Ordering::Equal,
                (None, Some(_)) => Ordering::Greater,
                (Some(_), None) => Ordering::Less,
                (Some(a), Some(b)) => a.cmp(&b),
            }),
    )
}

fn interpret(result: &ExecResult) -> UpgradeOutcome {
    if result.timed_out {
        return UpgradeOutcome::TimedOut;
    }
    match result.retcode {
        0 => UpgradeOutcome::Upgraded {
            reboot_required: false,
        },
        REBOOT_REQUIRED | REBOOT_INITIATED => UpgradeOutcome::Upgraded {
            reboot_required: true,
        },
        NOTHING_TO_DO => UpgradeOutcome::AlreadyLatest,
        PENDING_REBOOT | INSTALL_SUSPENDED => {
            UpgradeOutcome::Busy("a reboot is pending".to_string())
        }
        MSI_INSTALL_ALREADY_RUNNING => {
            UpgradeOutcome::Busy("another installation is in progress".to_string())
        }
        code => UpgradeOutcome::Failed {
            exit_code: i64::from(code),
            message: format!("choco exited {code}: {}", last_line(&result.stdout)),
        },
    }
}

#[cfg(test)]
#[path = "choco_tests.rs"]
mod tests;
