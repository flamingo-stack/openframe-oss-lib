use super::{last_line, QueryError, UpgradeOutcome, OUTDATED_TIMEOUT_SECS, UPGRADE_TIMEOUT_SECS};
use crate::executor::{execute_script, ExecResult, Privilege, ScriptParams};
use crate::models::PackageRef;

/// Ids with an update available. Rows without a source (not installed from winget or the
/// Store) and with an inexact installed version (`< 1.2`, `> 1.2`) are left out: winget
/// cannot upgrade the former and reports the latter as outdated forever. Without the WinGet
/// PowerShell module there is nothing to query: a distinct exit code says so.
const OUTDATED_SCRIPT: &str = r#"$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (-not (Get-Module -ListAvailable -Name Microsoft.WinGet.Client)) { exit 3 }
Import-Module Microsoft.WinGet.Client

$ids = @(
    Get-WinGetPackage |
        Where-Object { $_.Source -and $_.IsUpdateAvailable -and $_.InstalledVersion -notmatch '^[<>]' } |
        ForEach-Object { $_.Id }
)
ConvertTo-Json -InputObject $ids -Compress
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

pub(super) async fn outdated() -> Result<Vec<PackageRef>, QueryError> {
    let result = execute_script(ScriptParams {
        code: OUTDATED_SCRIPT,
        shell: "powershell",
        args: &[],
        timeout_secs: OUTDATED_TIMEOUT_SECS,
        privilege: Privilege::User,
        env_vars: &[],
    })
    .await;
    read_outdated(&result)
}

pub(super) async fn upgrade(package: &PackageRef) -> UpgradeOutcome {
    let PackageRef::Winget { id } = package else {
        return UpgradeOutcome::Failed(format!("not a winget package: {package:?}"));
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

fn read_outdated(result: &ExecResult) -> Result<Vec<PackageRef>, QueryError> {
    match result.retcode {
        0 => {}
        MODULE_MISSING => {
            return Err(QueryError::Unavailable(
                "the Microsoft.WinGet.Client PowerShell module is not installed".to_string(),
            ))
        }
        code => {
            return Err(QueryError::Failed(format!(
                "outdated query exited {code}: {}",
                result.stderr.trim()
            )))
        }
    }
    let ids: Vec<String> = serde_json::from_str(result.stdout.trim())
        .map_err(|e| QueryError::Failed(format!("unparseable outdated query output: {e}")))?;
    Ok(ids
        .into_iter()
        .map(|id| PackageRef::Winget { id })
        .collect())
}

fn interpret(result: &ExecResult) -> UpgradeOutcome {
    if result.timed_out {
        return UpgradeOutcome::Failed("timed out".to_string());
    }
    match result.retcode as u32 {
        0 | REBOOT_REQUIRED_TO_FINISH => UpgradeOutcome::Upgraded,
        UPDATE_NOT_APPLICABLE => UpgradeOutcome::AlreadyLatest,
        PACKAGE_IN_USE | FILE_IN_USE => {
            UpgradeOutcome::Deferred("the package's files are in use".to_string())
        }
        INSTALL_IN_PROGRESS | MSI_INSTALL_ALREADY_RUNNING => {
            UpgradeOutcome::Deferred("another installation is in progress".to_string())
        }
        REBOOT_REQUIRED_FOR_INSTALL => {
            UpgradeOutcome::Deferred("a reboot is required before installing".to_string())
        }
        COULD_NOT_LAUNCH => UpgradeOutcome::Deferred(format!(
            "could not run in the console user's session: {}",
            result.stderr.trim()
        )),
        code => UpgradeOutcome::Failed(format!(
            "winget exited 0x{code:08X}: {}",
            last_line(&result.stdout)
        )),
    }
}

#[cfg(test)]
#[path = "winget_tests.rs"]
mod tests;
