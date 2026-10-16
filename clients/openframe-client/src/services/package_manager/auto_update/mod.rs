//! Keeps policy packages at their latest version. See docs/designs/2026-10-15-auto-update-manager.md.

#[cfg(target_os = "macos")]
mod brew;
mod plan;
mod policy;
mod state;
#[cfg(target_os = "windows")]
mod winget;

pub use policy::PolicyStore;

use std::path::PathBuf;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tokio::sync::{mpsc, oneshot};
use tokio::task::JoinHandle;
use tokio::time::MissedTickBehavior;
use tracing::{error, info, warn};

use crate::models::{PackageRef, PolicyEntry};
use crate::platform::user_session::console_logon_id;
use crate::platform::{app_close, process_snapshot};
use crate::services::package_manager::update_gate::{self, BlockReason, GateDecision};
use crate::services::package_manager::{support, ManagerId, Presence};
use crate::services::tool_kill_service::ToolKillService;
use crate::services::tool_run_manager::ClientUpdatePending;
use crate::utils::in_progress::InProgress;
use crate::utils::latch::Latch;
use plan::Action;
use state::UpdateState;

const POLL: Duration = Duration::from_secs(60);
const RETRY_SECS: u64 = 5 * 60;
const PASS_BUDGET: Duration = Duration::from_secs(60 * 60);
const FORCE_QUEUE: usize = 16;
/// How long a forced upgrade lets apps close on request before terminating them.
const CLOSE_GRACE: Duration = Duration::from_secs(10);
pub(super) const OUTDATED_TIMEOUT_SECS: u32 = 300;
/// Also the longest a client self-update can wait for a running upgrade.
pub(super) const UPGRADE_TIMEOUT_SECS: u32 = 900;

/// Why a manager's outdated query gave no list this pass.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum QueryError {
    /// The manager cannot be queried on this machine right now (e.g. winget without its
    /// PowerShell module). Skipped like an absent manager: not a failure, not retried early.
    Unavailable(String),
    /// The query ran and failed; the pass counts the manager as not answered.
    Failed(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum UpgradeOutcome {
    Upgraded,
    AlreadyLatest,
    /// Could not run now (files in use, another installer, no session); retried next pass.
    Deferred(String),
    Failed(String),
}

/// What must stop a pass before its next upgrade: the agent is about to be replaced or restarted.
pub struct RestartSignals {
    pub client_update: ClientUpdatePending,
    pub agent_restart: Latch,
}

impl RestartSignals {
    fn pending(&self) -> bool {
        self.client_update.is_pending() || self.agent_restart.is_set()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ForceResult {
    Upgraded,
    AlreadyLatest,
    NotInPolicy,
    Unavailable(String),
    Failed(String),
}

type ForceRequest = (PackageRef, oneshot::Sender<ForceResult>);

/// Asks for one policy package to be upgraded now, whether or not its app is running. Any
/// transport (the chat, a command) holds a clone; the request is served between upgrades.
#[derive(Clone)]
pub struct ForceNow(mpsc::Sender<ForceRequest>);

impl ForceNow {
    pub async fn request(&self, package: PackageRef) -> ForceResult {
        let (reply, answer) = oneshot::channel();
        if self.0.send((package, reply)).await.is_err() {
            return ForceResult::Unavailable("auto-update is not running".to_string());
        }
        answer
            .await
            .unwrap_or_else(|_| ForceResult::Unavailable("auto-update stopped".to_string()))
    }
}

pub struct PackageAutoUpdateRunManager {
    worker: Arc<Worker>,
    /// Taken by `start`, which owns the loop from then on.
    force: Mutex<Option<mpsc::Receiver<ForceRequest>>>,
}

struct Worker {
    store: Arc<PolicyStore>,
    state_path: PathBuf,
    signals: RestartSignals,
    package_upgrades: InProgress,
    tool_kill_service: ToolKillService,
}

enum Wake {
    Poll,
    PolicyChanged,
    Force(ForceRequest),
}

impl PackageAutoUpdateRunManager {
    pub fn new(
        store: Arc<PolicyStore>,
        state_path: PathBuf,
        signals: RestartSignals,
        package_upgrades: InProgress,
        tool_kill_service: ToolKillService,
    ) -> (Self, ForceNow) {
        let (sender, force) = mpsc::channel(FORCE_QUEUE);
        let worker = Worker {
            store,
            state_path,
            signals,
            package_upgrades,
            tool_kill_service,
        };
        let manager = Self {
            worker: Arc::new(worker),
            force: Mutex::new(Some(force)),
        };
        (manager, ForceNow(sender))
    }

    pub fn start(&self) -> Option<JoinHandle<()>> {
        let Some(force) = self
            .force
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .take()
        else {
            warn!("Package auto-update already started");
            return None;
        };
        info!("Starting package auto-update");
        Some(tokio::spawn(run(self.worker.clone(), force)))
    }
}

async fn run(worker: Arc<Worker>, mut force: mpsc::Receiver<ForceRequest>) {
    let mut state = UpdateState::load(&worker.state_path);
    let mut not_before = 0;
    let mut poll = tokio::time::interval(POLL);
    poll.set_missed_tick_behavior(MissedTickBehavior::Skip);
    loop {
        let wake = tokio::select! {
            _ = poll.tick() => Wake::Poll,
            _ = worker.store.changed() => Wake::PolicyChanged,
            Some(request) = force.recv() => Wake::Force(request),
        };
        match wake {
            Wake::Poll => {
                let now = unix_now();
                let policy = worker.store.entries();
                if now >= not_before && state.is_due(now, console_logon_id(), &policy) {
                    not_before = worker.pass(&mut state, &mut force).await;
                }
            }
            Wake::PolicyChanged => {
                not_before = worker.pass(&mut state, &mut force).await;
            }
            Wake::Force((package, reply)) => {
                let _ = reply.send(worker.force(&package).await);
            }
        }
    }
}

impl Worker {
    /// One pass over the policy. Returns the earliest time the next due pass may start: later
    /// than now only when a manager did not answer, so a logon pass is retried, not hammered.
    async fn pass(&self, state: &mut UpdateState, force: &mut mpsc::Receiver<ForceRequest>) -> u64 {
        let started = Instant::now();
        let now = unix_now();
        let logon = console_logon_id();
        let policy = self.store.entries();
        state.retain(&policy);

        let mut all_answered = true;
        let mut due: Vec<&PolicyEntry> = Vec::new();
        for manager in managers_in(&policy) {
            if !support::is_supported(manager) {
                continue;
            }
            match manager.presence().await {
                Presence::Present => {}
                Presence::Absent => {
                    info!(?manager, "Package manager absent, skipping it this pass");
                    continue;
                }
                Presence::Unknown => {
                    info!(
                        ?manager,
                        "Package manager presence unknown, skipping it this pass"
                    );
                    all_answered = false;
                    continue;
                }
            }
            match outdated(manager).await {
                Ok(outdated) => {
                    state.observe(&policy, |p| manager_of(p) == manager, &outdated, now);
                    due.extend(policy.iter().filter(|e| outdated.contains(&e.package)));
                }
                Err(QueryError::Unavailable(reason)) => {
                    info!(?manager, %reason, "Package manager unavailable for auto-update, skipping it this pass");
                }
                Err(QueryError::Failed(reason)) => {
                    warn!(?manager, %reason, "Outdated query failed, skipping the manager this pass");
                    all_answered = false;
                }
            }
        }

        if !due.is_empty() {
            let packages: Vec<PackageRef> = due.iter().map(|e| e.package.clone()).collect();
            let prepared = update_gate::prepare(&packages).await;
            for entry in due {
                while let Ok((package, reply)) = force.try_recv() {
                    let _ = reply.send(self.force(&package).await);
                }
                if self.signals.pending() {
                    info!("Agent restart pending, stopping the pass; it resumes after the restart");
                    self.save(state);
                    return 0;
                }
                if started.elapsed() >= PASS_BUDGET {
                    info!("Pass budget spent, the rest waits for the next pass");
                    break;
                }
                let gate = prepared.check_now(&entry.package).await;
                let since = state.outdated_since(&entry.package).unwrap_or(now);
                match plan::decide(&gate, &entry.policy, since, unix_now()) {
                    Action::Upgrade => {
                        let outcome = self.upgrade(&entry.package).await;
                        info!(package = ?entry.package, ?outcome, "Upgraded");
                    }
                    Action::Force => {
                        let outcome = self.force_upgrade(&entry.package, &holders(&gate)).await;
                        info!(package = ?entry.package, ?outcome, ?gate, "Force deadline passed, upgraded");
                    }
                    Action::Wait { force_at } => {
                        info!(package = ?entry.package, holders = ?holders(&gate), ?force_at, "Waiting for the app to close")
                    }
                }
            }
        }

        state.complete_pass(unix_now(), logon, all_answered);
        self.save(state);
        if all_answered {
            0
        } else {
            unix_now() + RETRY_SECS
        }
    }

    async fn force(&self, package: &PackageRef) -> ForceResult {
        if !self.store.entries().iter().any(|e| &e.package == package) {
            return ForceResult::NotInPolicy;
        }
        if self.signals.pending() {
            return ForceResult::Unavailable("agent restart pending".to_string());
        }
        let manager = manager_of(package);
        if !support::is_supported(manager) || manager.presence().await != Presence::Present {
            return ForceResult::Unavailable(format!("{manager:?} is not available"));
        }
        match outdated(manager).await {
            Ok(outdated) if !outdated.contains(package) => return ForceResult::AlreadyLatest,
            Ok(_) => {}
            Err(QueryError::Unavailable(reason) | QueryError::Failed(reason)) => {
                return ForceResult::Unavailable(reason)
            }
        }
        let prepared = update_gate::prepare(std::slice::from_ref(package)).await;
        let gate = prepared.check_now(package).await;
        let outcome = self.force_upgrade(package, &holders(&gate)).await;
        info!(?package, ?outcome, "Forced upgrade");
        match outcome {
            UpgradeOutcome::Upgraded => ForceResult::Upgraded,
            UpgradeOutcome::AlreadyLatest => ForceResult::AlreadyLatest,
            UpgradeOutcome::Deferred(reason) => ForceResult::Unavailable(reason),
            UpgradeOutcome::Failed(reason) => ForceResult::Failed(reason),
        }
    }

    /// Closes the app holding the package — asked first, terminated after `CLOSE_GRACE` — then
    /// upgrades: installers that refuse to run beside their app (Inno Setup) need it gone.
    async fn force_upgrade(&self, package: &PackageRef, holders: &[u32]) -> UpgradeOutcome {
        let _running = self.package_upgrades.begin();
        self.close(holders).await;
        self.upgrade(package).await
    }

    async fn close(&self, holders: &[u32]) {
        if holders.is_empty() {
            return;
        }
        app_close::ask_to_close(holders).await;
        let deadline = Instant::now() + CLOSE_GRACE;
        let mut alive = still_running(holders).await;
        while !alive.is_empty() && Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(500)).await;
            alive = still_running(holders).await;
        }
        for pid in alive {
            if let Err(e) = self
                .tool_kill_service
                .stop_process(pid, "forced package upgrade")
                .await
            {
                warn!(
                    pid,
                    "Could not stop an app before its forced upgrade: {:#}", e
                );
            }
        }
    }

    async fn upgrade(&self, package: &PackageRef) -> UpgradeOutcome {
        let _running = self.package_upgrades.begin();
        match package {
            #[cfg(target_os = "windows")]
            PackageRef::Winget { .. } => winget::upgrade(package).await,
            #[cfg(target_os = "macos")]
            PackageRef::Brew { .. } => brew::upgrade(package).await,
            _ => UpgradeOutcome::Failed(format!("no package manager for {package:?} here")),
        }
    }

    fn save(&self, state: &UpdateState) {
        if let Err(e) = state.save(&self.state_path) {
            error!("Failed to persist auto-update state: {:#}", e);
        }
    }
}

async fn outdated(manager: ManagerId) -> Result<Vec<PackageRef>, QueryError> {
    match manager {
        #[cfg(target_os = "windows")]
        ManagerId::Winget => winget::outdated().await,
        #[cfg(target_os = "macos")]
        ManagerId::Brew => brew::outdated().await,
        _ => Err(QueryError::Unavailable(format!(
            "{manager:?} is not supported here"
        ))),
    }
}

fn manager_of(package: &PackageRef) -> ManagerId {
    match package {
        PackageRef::Winget { .. } => ManagerId::Winget,
        PackageRef::Brew { .. } => ManagerId::Brew,
        PackageRef::Choco { .. } => ManagerId::Choco,
    }
}

fn managers_in(policy: &[PolicyEntry]) -> Vec<ManagerId> {
    let mut managers: Vec<ManagerId> = policy.iter().map(|e| manager_of(&e.package)).collect();
    managers.sort();
    managers.dedup();
    managers
}

fn holders(gate: &GateDecision) -> Vec<u32> {
    match gate {
        GateDecision::Blocked(BlockReason::Running { holders }) => {
            holders.iter().map(|h| h.pid).collect()
        }
        _ => Vec::new(),
    }
}

async fn still_running(pids: &[u32]) -> Vec<u32> {
    let processes = tokio::task::spawn_blocking(process_snapshot::snapshot)
        .await
        .unwrap_or_default();
    pids.iter()
        .copied()
        .filter(|pid| processes.iter().any(|p| p.pid == *pid))
        .collect()
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs())
}

/// The last non-empty line of a command's output, for a one-line failure reason.
pub(super) fn last_line(output: &str) -> &str {
    output
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or_default()
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
