use super::{interpret_markers, ManagerId, ManagerUpdater, UpdateOutcome};
use crate::executor::{ExecResult, Privilege};

pub struct Winget;

impl ManagerUpdater for Winget {
    fn id(&self) -> ManagerId {
        ManagerId::Winget
    }

    fn privilege(&self) -> Privilege {
        Privilege::User
    }

    fn shell(&self) -> &'static str {
        "powershell"
    }

    fn update_script(&self) -> String {
        r#"function Get-WingetExe {
    $p = (Get-AppxPackage -Name Microsoft.DesktopAppInstaller -ErrorAction SilentlyContinue).InstallLocation
    if ($p -and (Test-Path "$p\winget.exe")) { return "$p\winget.exe" }
    return $null
}

$exe = Get-WingetExe
if (-not $exe) { Write-Output '__NOT_PRESENT__'; exit 0 }
$before = (& $exe --version).Trim()

& $exe upgrade --id Microsoft.AppInstaller --exact --silent --accept-source-agreements --accept-package-agreements --disable-interactivity | Out-Null

$exe = Get-WingetExe
if (-not $exe) { Write-Output 'upgrade left winget unavailable'; exit 1 }
$after = (& $exe --version).Trim()

if ($after -eq $before) { Write-Output "__LATEST__|$before"; exit 0 }
Write-Output "__FROM__|$before"
Write-Output "__TO__|$after"
exit 0
"#
        .to_string()
    }

    fn interpret(&self, result: &ExecResult) -> UpdateOutcome {
        interpret_markers(result)
    }
}
