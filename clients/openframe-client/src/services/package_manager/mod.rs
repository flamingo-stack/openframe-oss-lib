pub mod auto_update;
pub mod report_publisher;
pub mod report_run_manager;
mod state;
mod support;
pub mod update_gate;

use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
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
    pub const ALL: &'static [ManagerId] = &[ManagerId::Brew, ManagerId::Choco, ManagerId::Winget];

    pub async fn presence(self) -> Presence {
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
            ManagerId::Choco => choco_presence(),
            ManagerId::Winget => winget_presence().await,
        }
    }
}

#[cfg(target_os = "windows")]
fn choco_presence() -> Presence {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    const ENVIRONMENT: &str = r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment";

    let root = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(ENVIRONMENT)
        .ok()
        .and_then(|key| key.get_value::<String, _>("ChocolateyInstall").ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            let program_data =
                std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_string());
            format!(r"{}\chocolatey", program_data)
        });

    if Path::new(&root).join("bin").join("choco.exe").exists() {
        Presence::Present
    } else {
        Presence::Absent
    }
}

#[cfg(not(target_os = "windows"))]
fn choco_presence() -> Presence {
    Presence::Unknown
}

#[cfg(target_os = "windows")]
const WINGET_PRESENCE_SCRIPT: &str = r#"$p = (Get-AppxPackage -Name Microsoft.DesktopAppInstaller -ErrorAction SilentlyContinue).InstallLocation
if ($p -and (Test-Path "$p\winget.exe")) { exit 0 }
exit 1
"#;

pub const PRESENCE_PROBE_TIMEOUT_SECS: u32 = 60;

#[cfg(target_os = "windows")]
async fn winget_presence() -> Presence {
    use crate::executor::{execute_script, Privilege, ScriptParams};

    const SETUP_FAILURE_RETCODE: i32 = 85;

    let result = execute_script(ScriptParams {
        code: WINGET_PRESENCE_SCRIPT,
        shell: "powershell",
        args: &[],
        timeout_secs: PRESENCE_PROBE_TIMEOUT_SECS,
        privilege: Privilege::User,
        env_vars: &[],
    })
    .await;

    if result.timed_out || result.retcode == SETUP_FAILURE_RETCODE {
        return Presence::Unknown;
    }

    match result.retcode {
        0 => Presence::Present,
        1 => Presence::Absent,
        _ => Presence::Unknown,
    }
}

#[cfg(not(target_os = "windows"))]
async fn winget_presence() -> Presence {
    Presence::Unknown
}
