use std::path::Path;

use tokio::time::{Duration, Instant};

use super::check::{may_force, not_running, plan, verify, Plan};
use super::{wait_until, InstallGate, Refusal};
use crate::config::update_config::SELF_RESTART_IDLE_WAIT_SECS;
use crate::executor::console_user_present;
use crate::executor::{execute_script, ExecResult, Privilege, ScriptParams};
use crate::models::{AdoptFailReason, AdoptOutcome, PackageAdoptMessage};
use crate::platform::app_bundle::owner_uid;
use crate::platform::user_session::get_console_user;
use crate::services::package_manager::brew::{
    self, BrewLock, Cask, CaskInfo, APPLICATIONS, CASK_INFO, COULD_NOT_LAUNCH,
};
use crate::services::package_manager::{last_line, update_gate, ManagerId, Presence};
use crate::utils::in_progress::InProgressGuard;

const INFO: &str = r#""$BREW" update >/dev/null || true
HOMEBREW_NO_AUTO_UPDATE=1 "$BREW" info --json=v2 --cask "$@"
"#;

const FETCH: &str = r#"NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW" fetch --cask "$@"
"#;

const ADOPT: &str = r#"NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW" install --cask --adopt "$@"
"#;

const FORCE: &str = r#"NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW" install --cask --force "$@"
"#;

const INFO_TIMEOUT_SECS: u32 = 300;
const FETCH_TIMEOUT_SECS: u32 = 900;
const ADOPT_TIMEOUT_SECS: u32 = 180;
const FORCE_TIMEOUT_SECS: u32 = 300;
const INSTALLED_INFO_TIMEOUT_SECS: u32 = 30;
const INSTALL_PHASE_SECS: u64 =
    (ADOPT_TIMEOUT_SECS + FORCE_TIMEOUT_SECS + 2 * INSTALLED_INFO_TIMEOUT_SECS) as u64;
const INSTALL_PHASE: Duration = Duration::from_secs(INSTALL_PHASE_SECS);
const CONSOLE_USER_POLL: Duration = Duration::from_secs(60);

const _: () = assert!(INSTALL_PHASE_SECS < SELF_RESTART_IDLE_WAIT_SECS);

pub(super) async fn adopt(
    name: &str,
    order: &PackageAdoptMessage,
    install: &InstallGate,
    brew: &BrewLock,
    deadline: Instant,
) -> (Result<AdoptOutcome, Refusal>, Option<InProgressGuard>) {
    let (app, bundle_id) = match prepare(name, order, brew, deadline).await {
        Ok(Plan::Install { app, bundle_id }) => (app, bundle_id),
        Ok(Plan::AlreadyManaged) => return (Ok(AdoptOutcome::AlreadyManaged), None),
        Err(refusal) => return (Err(refusal), None),
    };
    let _turn = brew.turn().await;
    if too_late(deadline) {
        return (
            Err(Refusal::new(
                AdoptFailReason::Timeout,
                "too little time was left to install before the backend stops waiting; nothing was changed",
            )),
            None,
        );
    }
    let Some(running) = install.enter() else {
        return (
            Err(Refusal::new(
                AdoptFailReason::RestartPending,
                "the agent is about to restart; nothing was changed",
            )),
            None,
        );
    };
    (install_over(name, &app, bundle_id).await, Some(running))
}

async fn prepare<'a>(
    name: &str,
    order: &'a PackageAdoptMessage,
    brew: &BrewLock,
    deadline: Instant,
) -> Result<Plan<'a>, Refusal> {
    if too_late(deadline) {
        return Err(Refusal::new(
            AdoptFailReason::Timeout,
            "the order waited too long in the queue to finish before the backend stops waiting; nothing was changed",
        ));
    }
    if ManagerId::Brew.presence().await != Presence::Present {
        return Err(Refusal::new(
            AdoptFailReason::ManagerMissing,
            "Homebrew is not installed",
        ));
    }
    if !wait_until(
        console_user_present,
        deadline,
        INSTALL_PHASE,
        CONSOLE_USER_POLL,
    )
    .await
    {
        return Err(Refusal::new(
            AdoptFailReason::NoUserSession,
            "nobody logged in before the backend stops waiting; nothing was changed",
        ));
    }
    let cask = {
        let _turn = brew.turn().await;
        info(name, INFO, INFO_TIMEOUT_SECS).await?
    };
    let plan = plan(&cask, order.bundle_id.as_deref(), Path::new(APPLICATIONS))?;
    if let Plan::Install { app, .. } = &plan {
        owned_by_console_user(app)?;
        let _turn = brew.turn().await;
        succeeded(
            &run(name, FETCH, FETCH_TIMEOUT_SECS).await,
            "brew fetch --cask",
        )?;
    }
    Ok(plan)
}

async fn install_over(name: &str, app: &Path, bundle_id: &str) -> Result<AdoptOutcome, Refusal> {
    let adopted = run(name, ADOPT, ADOPT_TIMEOUT_SECS).await;
    finished(&adopted, "brew install --cask --adopt")?;
    let cask = info(name, CASK_INFO, INSTALLED_INFO_TIMEOUT_SECS).await?;
    match (adopted.retcode == 0, cask.installed.is_some()) {
        (true, true) => return verify(&cask, app, bundle_id, AdoptOutcome::AdoptedInPlace),
        (false, false) => {}
        _ => return Err(manager_error(&adopted, "brew install --cask --adopt")),
    }
    may_force(&cask, app)?;
    not_running(app, &update_gate::snapshot().await)?;
    succeeded(
        &run(name, FORCE, FORCE_TIMEOUT_SECS).await,
        "brew install --cask --force",
    )?;
    let cask = info(name, CASK_INFO, INSTALLED_INFO_TIMEOUT_SECS).await?;
    verify(&cask, app, bundle_id, AdoptOutcome::Reinstalled)
}

fn too_late(deadline: Instant) -> bool {
    deadline.saturating_duration_since(Instant::now()) < INSTALL_PHASE
}

fn owned_by_console_user(app: &Path) -> Result<(), Refusal> {
    let Some(user) = get_console_user() else {
        return Err(Refusal::new(
            AdoptFailReason::NoUserSession,
            "nobody is logged in to run Homebrew as",
        ));
    };
    let owner = owner_uid(app)
        .map_err(|e| Refusal::new(AdoptFailReason::IdentityUnknown, format!("{e:#}")))?;
    if owner == user.uid {
        return Ok(());
    }
    Err(Refusal::new(
        AdoptFailReason::NeedsAdmin,
        format!(
            "the app at {} belongs to uid {owner}, not to {} (uid {}); Homebrew cannot update it without an administrator",
            app.display(),
            user.username,
            user.uid
        ),
    ))
}

async fn info(name: &str, script: &str, timeout_secs: u32) -> Result<Cask, Refusal> {
    let result = run(name, script, timeout_secs).await;
    succeeded(&result, "brew info --cask")?;
    let info = CaskInfo::from_output(&result.stdout).map_err(|e| {
        Refusal::new(
            AdoptFailReason::ManagerError,
            format!("unparseable brew info output: {e}"),
        )
    })?;
    info.casks
        .into_iter()
        .find(|cask| cask.is_named(name))
        .ok_or_else(|| {
            Refusal::new(
                AdoptFailReason::ManagerError,
                format!("brew info named no cask {name}"),
            )
        })
}

async fn run(name: &str, script: &str, timeout_secs: u32) -> ExecResult {
    execute_script(ScriptParams {
        code: &brew::script(script),
        shell: "bash",
        args: &[name.to_string()],
        timeout_secs,
        privilege: Privilege::User,
        env_vars: &[],
    })
    .await
}

fn finished(result: &ExecResult, command: &str) -> Result<(), Refusal> {
    if result.timed_out {
        return Err(Refusal::new(
            AdoptFailReason::Timeout,
            format!("{command} did not finish in time"),
        ));
    }
    if result.retcode == COULD_NOT_LAUNCH {
        return Err(Refusal::new(
            AdoptFailReason::NoUserSession,
            format!("{command} could not run as the console user"),
        ));
    }
    Ok(())
}

fn succeeded(result: &ExecResult, command: &str) -> Result<(), Refusal> {
    finished(result, command)?;
    if result.retcode == 0 {
        Ok(())
    } else {
        Err(manager_error(result, command))
    }
}

fn manager_error(result: &ExecResult, command: &str) -> Refusal {
    Refusal::new(
        AdoptFailReason::ManagerError,
        format!(
            "{command} exited {}: {}",
            result.retcode,
            last_line(&result.stderr)
        ),
    )
}
