use super::{ManagerId, ManagerUpdater, UpdateOutcome};
use crate::executor::{ExecResult, Privilege};

pub struct Brew;

impl ManagerUpdater for Brew {
    fn id(&self) -> ManagerId {
        ManagerId::Brew
    }

    fn privilege(&self) -> Privilege {
        Privilege::User
    }

    fn shell(&self) -> &'static str {
        "bash"
    }

    fn update_script(&self) -> String {
        "#!/bin/bash\nif ! command -v brew >/dev/null 2>&1; then echo __NOT_PRESENT__; exit 0; fi\nbrew update".to_string()
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
        if result.stdout.contains("Already up-to-date") {
            UpdateOutcome::AlreadyLatest { version: None }
        } else {
            UpdateOutcome::Updated {
                from: None,
                to: None,
            }
        }
    }
}
