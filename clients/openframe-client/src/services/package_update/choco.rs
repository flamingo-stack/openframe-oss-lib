use super::{ManagerId, ManagerUpdater, UpdateOutcome};
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
        "if (-not (Get-Command choco -ErrorAction SilentlyContinue)) { Write-Output '__NOT_PRESENT__'; exit 0 }\nchoco upgrade chocolatey -y --no-progress --limit-output".to_string()
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
        if result.stdout.contains("is the latest version") {
            UpdateOutcome::AlreadyLatest { version: None }
        } else {
            UpdateOutcome::Updated {
                from: None,
                to: None,
            }
        }
    }
}
