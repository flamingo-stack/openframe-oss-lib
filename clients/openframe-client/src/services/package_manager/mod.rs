#[cfg(target_os = "macos")]
mod brew;
#[cfg(target_os = "windows")]
mod choco;
pub mod missing;
#[cfg(target_os = "windows")]
mod winget;

use crate::executor::{execute_script, ExecResult, Privilege, ScriptParams};
use serde::Serialize;
use std::path::Path;
use tokio::time::{interval, Duration};
use tracing::info;

const UPDATE_INTERVAL: Duration = Duration::from_secs(3600);
const UPDATE_TIMEOUT_SECS: u32 = 600;
const SETUP_FAILURE_RETCODE: i32 = 85;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ManagerId {
    Brew,
    Choco,
    Winget,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Presence {
    Present,
    Absent,
    Unknown,
}

impl ManagerId {
    pub fn for_current_platform() -> &'static [ManagerId] {
        #[cfg(target_os = "macos")]
        {
            &[ManagerId::Brew]
        }
        #[cfg(target_os = "windows")]
        {
            &[ManagerId::Choco, ManagerId::Winget]
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            &[]
        }
    }

    pub fn presence(self) -> Presence {
        match self {
            ManagerId::Brew => {
                if Path::new("/opt/homebrew/bin/brew").exists()
                    || Path::new("/usr/local/bin/brew").exists()
                {
                    Presence::Present
                } else {
                    Presence::Absent
                }
            }
            // TODO(windows): real choco/winget detection; Unknown until Windows work.
            ManagerId::Choco | ManagerId::Winget => Presence::Unknown,
        }
    }
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

#[cfg(target_os = "windows")]
mod markers {
    pub const NOT_PRESENT: &str = "__NOT_PRESENT__";
    pub const LATEST: &str = "__LATEST__|";
    pub const FROM: &str = "__FROM__|";
    pub const TO: &str = "__TO__|";
}

#[cfg(target_os = "windows")]
fn marker(stdout: &str, prefix: &str) -> Option<String> {
    stdout.lines().find_map(|line| {
        line.trim()
            .strip_prefix(prefix)
            .map(|v| v.trim().to_string())
    })
}

#[cfg(target_os = "windows")]
fn interpret_markers(result: &ExecResult) -> UpdateOutcome {
    if result.stdout.contains(markers::NOT_PRESENT) {
        return UpdateOutcome::NotPresent;
    }
    if let Some(version) = marker(&result.stdout, markers::LATEST) {
        return UpdateOutcome::AlreadyLatest {
            version: Some(version),
        };
    }
    if result.retcode != 0 {
        return UpdateOutcome::Failed {
            detail: result.stderr.clone(),
        };
    }
    UpdateOutcome::Updated {
        from: marker(&result.stdout, markers::FROM),
        to: marker(&result.stdout, markers::TO),
    }
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
                    if manager.id().presence() == Presence::Absent {
                        continue;
                    }

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
