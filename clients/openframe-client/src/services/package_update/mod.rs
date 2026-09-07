#[cfg(target_os = "macos")]
mod brew;
#[cfg(target_os = "windows")]
mod choco;
#[cfg(target_os = "windows")]
mod winget;

use crate::executor::{execute_script, ExecResult, Privilege, ScriptParams};
use tokio::time::{interval, Duration};
use tracing::info;

const UPDATE_INTERVAL: Duration = Duration::from_secs(3600);
const UPDATE_TIMEOUT_SECS: u32 = 600;
const SETUP_FAILURE_RETCODE: i32 = 85;

#[derive(Debug, Clone, Copy)]
pub enum ManagerId {
    Brew,
    Choco,
    Winget,
}

#[derive(Debug)]
pub enum UpdateOutcome {
    Updated {
        from: Option<String>,
        to: Option<String>,
    },
    AlreadyLatest {
        version: Option<String>,
    },
    NotPresent,
    Deferred,
    Failed {
        detail: String,
    },
}

pub trait ManagerUpdater: Send + Sync {
    fn id(&self) -> ManagerId;
    fn privilege(&self) -> Privilege;
    fn shell(&self) -> &'static str;
    fn update_script(&self) -> String;
    fn interpret(&self, result: &ExecResult) -> UpdateOutcome;
}

fn managers() -> Vec<Box<dyn ManagerUpdater>> {
    #[cfg(target_os = "macos")]
    {
        vec![Box::new(brew::Brew)]
    }
    #[cfg(target_os = "windows")]
    {
        vec![Box::new(choco::Choco), Box::new(winget::Winget)]
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Vec::new()
    }
}

pub struct PackageManagerUpdateRunManager;

impl PackageManagerUpdateRunManager {
    pub fn new() -> Self {
        Self
    }

    pub fn start(&self) {
        info!("Starting package manager update run manager");

        tokio::spawn(async move {
            let mut ticker = interval(UPDATE_INTERVAL);

            loop {
                ticker.tick().await;

                for manager in managers() {
                    let code = manager.update_script();
                    let params = ScriptParams {
                        code: &code,
                        shell: manager.shell(),
                        args: &[],
                        timeout_secs: UPDATE_TIMEOUT_SECS,
                        privilege: manager.privilege(),
                        env_vars: &[],
                    };

                    let result = execute_script(params).await;

                    let outcome = if result.retcode == SETUP_FAILURE_RETCODE
                        && manager.privilege() == Privilege::User
                    {
                        UpdateOutcome::Deferred
                    } else {
                        manager.interpret(&result)
                    };

                    info!(
                        manager = ?manager.id(),
                        outcome = ?outcome,
                        "Package manager update check completed"
                    );
                }
            }
        });
    }
}

impl Default for PackageManagerUpdateRunManager {
    fn default() -> Self {
        Self::new()
    }
}
