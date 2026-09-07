use super::{ManagerId, ManagerUpdater, UpdateOutcome};
use crate::executor::{ExecResult, Privilege};

pub struct Winget;

impl ManagerUpdater for Winget {
    fn id(&self) -> ManagerId {
        ManagerId::Winget
    }

    fn privilege(&self) -> Privilege {
        Privilege::Agent
    }

    fn shell(&self) -> &'static str {
        "powershell"
    }

    fn update_script(&self) -> String {
        "if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { Write-Output '__NOT_PRESENT__'; exit 0 }\nif (-not (Get-Module -ListAvailable Microsoft.WinGet.Client)) { Install-Module Microsoft.WinGet.Client -Scope AllUsers -Force }\nRepair-WinGetPackageManager -Latest -AllUsers -Force".to_string()
    }

    fn interpret(&self, result: &ExecResult) -> UpdateOutcome {
        if result.stdout.contains("__NOT_PRESENT__") {
            return UpdateOutcome::NotPresent;
        }
        if result.retcode != 0 {
            return UpdateOutcome::Failed {
                detail: result.stderr.clone(),
            };
        }
        UpdateOutcome::AlreadyLatest { version: None }
    }
}
