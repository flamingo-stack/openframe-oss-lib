use super::{interpret_markers, ManagerId, ManagerUpdater, UpdateOutcome};
use crate::executor::{ExecResult, Privilege};

pub struct Choco;

impl ManagerUpdater for Choco {
    fn id(&self) -> ManagerId {
        ManagerId::Choco
    }

    fn privilege(&self) -> Privilege {
        Privilege::Agent
    }

    fn shell(&self) -> &'static str {
        "powershell"
    }

    fn update_script(&self) -> String {
        r#"$env:PATH = "$env:PATH;$env:ProgramData\chocolatey\bin"
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) { Write-Output '__NOT_PRESENT__'; exit 0 }

$line = choco outdated --limit-output | Where-Object { $_ -like 'chocolatey|*' }
if (-not $line) { Write-Output "__LATEST__|$(choco --version)"; exit 0 }

$parts = $line -split '\|'
Write-Output "__FROM__|$($parts[1])"
Write-Output "__TO__|$($parts[2])"
choco upgrade chocolatey -y --no-progress
exit $LASTEXITCODE
"#
        .to_string()
    }

    fn interpret(&self, result: &ExecResult) -> UpdateOutcome {
        interpret_markers(result)
    }
}
