use serde::Deserialize;

use super::{
    last_line, Probe, ProbeState, QueryError, UpgradeOutcome, PROBE_TIMEOUT_SECS,
    UPGRADE_TIMEOUT_SECS,
};
use crate::executor::{execute_script, ExecResult, Privilege, ScriptParams};
use crate::models::PackageRef;

/// The installed rows of one id with their source and update flag; exit 3 means no WinGet module.
const PROBE_SCRIPT: &str = r#"$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (-not (Get-Module -ListAvailable -Name Microsoft.WinGet.Client)) { exit 3 }
Import-Module Microsoft.WinGet.Client

$rows = @(
    Get-WinGetPackage -Id $args[0] -MatchOption EqualsCaseInsensitive |
        ForEach-Object { [pscustomobject]@{ installed = $_.InstalledVersion; available = @($_.AvailableVersions)[0]; source = $_.Source; update = [bool]$_.IsUpdateAvailable } }
)
$json = ConvertTo-Json -InputObject $rows -Compress
[regex]::Replace($json, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
"#;

/// The backend's `winget-update-software.ps1`, verbatim, so both paths upgrade the same way.
const UPGRADE_SCRIPT: &str = r#"$ErrorActionPreference = 'Stop'

if ($args.Count -eq 0) {
    Write-Output 'no package specified'
    exit 64
}

winget upgrade @args --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
exit $LASTEXITCODE
"#;

const UPDATE_NOT_APPLICABLE: u32 = 0x8A15_002B;
const PACKAGE_IN_USE: u32 = 0x8A15_0101;
const INSTALL_IN_PROGRESS: u32 = 0x8A15_0102;
const FILE_IN_USE: u32 = 0x8A15_0103;
const REBOOT_REQUIRED_TO_FINISH: u32 = 0x8A15_0109;
const REBOOT_REQUIRED_FOR_INSTALL: u32 = 0x8A15_010A;
const MSI_INSTALL_ALREADY_RUNNING: u32 = 1618;
const COULD_NOT_LAUNCH: u32 = 85;
const MODULE_MISSING: i32 = 3;

#[derive(Deserialize)]
struct Row {
    #[serde(default)]
    installed: Option<String>,
    #[serde(default)]
    available: Option<String>,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    update: bool,
}

pub(super) async fn probe(package: &PackageRef) -> Result<Probe, QueryError> {
    let PackageRef::Winget { id } = package else {
        return Err(QueryError::Unavailable(format!(
            "not a winget package: {package:?}"
        )));
    };
    let result = execute_script(ScriptParams {
        code: PROBE_SCRIPT,
        shell: "powershell",
        args: std::slice::from_ref(id),
        timeout_secs: PROBE_TIMEOUT_SECS,
        privilege: Privilege::User,
        env_vars: &[],
    })
    .await;
    read_probe(&result)
}

pub(super) async fn upgrade(package: &PackageRef) -> UpgradeOutcome {
    let PackageRef::Winget { id } = package else {
        return UpgradeOutcome::Failed {
            exit_code: 0,
            message: format!("not a winget package: {package:?}"),
        };
    };
    let args = ["--id".to_string(), id.clone(), "-e".to_string()];
    let result = execute_script(ScriptParams {
        code: UPGRADE_SCRIPT,
        shell: "powershell",
        args: &args,
        timeout_secs: UPGRADE_TIMEOUT_SECS,
        privilege: Privilege::ElevatedUser,
        env_vars: &[],
    })
    .await;
    interpret(&result)
}

/// Several rows (scopes, architectures) count as outdated when any row winget can upgrade has an update.
fn read_probe(result: &ExecResult) -> Result<Probe, QueryError> {
    match result.retcode {
        0 => {}
        MODULE_MISSING => {
            return Err(QueryError::Unavailable(
                "the Microsoft.WinGet.Client PowerShell module is not installed".to_string(),
            ))
        }
        code => {
            return Err(QueryError::Failed(format!(
                "package query exited {code}: {}",
                result.stderr.trim()
            )))
        }
    }
    let rows: Vec<Row> = serde_json::from_str(result.stdout.trim())
        .map_err(|e| QueryError::Failed(format!("unparseable package query output: {e}")))?;
    let upgradable = |row: &&Row| {
        row.source
            .as_deref()
            .is_some_and(|source| !source.is_empty())
            && !row
                .installed
                .as_deref()
                .unwrap_or_default()
                .starts_with(['<', '>'])
    };
    let Some(row) = rows
        .iter()
        .filter(upgradable)
        .find(|row| row.update)
        .or_else(|| rows.iter().find(upgradable))
        .or_else(|| rows.first())
    else {
        return Ok(Probe {
            state: ProbeState::NotInstalled,
            installed_version: None,
            available_version: None,
        });
    };
    let state = if !upgradable(&row) {
        if row
            .source
            .as_deref()
            .is_some_and(|source| !source.is_empty())
        {
            ProbeState::NotUpgradable("its installed version is unknown to winget".to_string())
        } else {
            ProbeState::NotUpgradable("not installed from a winget source".to_string())
        }
    } else if row.update {
        ProbeState::Outdated
    } else {
        ProbeState::UpToDate
    };
    Ok(Probe {
        state,
        installed_version: row.installed.clone().filter(|v| !v.is_empty()),
        available_version: row.available.clone().filter(|v| !v.is_empty()),
    })
}

fn interpret(result: &ExecResult) -> UpgradeOutcome {
    if result.timed_out {
        return UpgradeOutcome::TimedOut;
    }
    let code = result.retcode as u32;
    match code {
        0 => UpgradeOutcome::Upgraded {
            reboot_required: false,
        },
        REBOOT_REQUIRED_TO_FINISH => UpgradeOutcome::Upgraded {
            reboot_required: true,
        },
        UPDATE_NOT_APPLICABLE => UpgradeOutcome::AlreadyLatest,
        PACKAGE_IN_USE | FILE_IN_USE => {
            UpgradeOutcome::InUse("the package's files are in use".to_string())
        }
        INSTALL_IN_PROGRESS | MSI_INSTALL_ALREADY_RUNNING => {
            UpgradeOutcome::Busy("another installation is in progress".to_string())
        }
        REBOOT_REQUIRED_FOR_INSTALL => {
            UpgradeOutcome::Busy("a reboot is required before installing".to_string())
        }
        COULD_NOT_LAUNCH
            if result.stderr.contains("no linked token")
                || result.stderr.contains("not a local administrator") =>
        {
            UpgradeOutcome::Failed {
                exit_code: i64::from(code),
                message: format!(
                    "the console user cannot run elevated: {}",
                    result.stderr.trim()
                ),
            }
        }
        COULD_NOT_LAUNCH => UpgradeOutcome::Busy(format!(
            "could not run in the console user's session: {}",
            result.stderr.trim()
        )),
        code => UpgradeOutcome::Failed {
            exit_code: i64::from(code),
            message: format!("winget exited 0x{code:08X}: {}", last_line(&result.stdout)),
        },
    }
}

#[cfg(test)]
#[path = "winget_tests.rs"]
mod tests;
