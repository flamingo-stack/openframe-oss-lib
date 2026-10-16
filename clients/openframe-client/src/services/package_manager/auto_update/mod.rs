mod close;
mod managers;
mod pass;
mod plan;
mod policy;
mod state;

pub use policy::PolicyStore;

use std::path::PathBuf;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tokio::sync::{mpsc, oneshot};
use tokio::task::JoinHandle;
use tokio::time::MissedTickBehavior;
use tracing::{error, info, warn};

use crate::models::PackageRef;
use crate::platform::user_session::console_logon_id;
use crate::services::package_manager::update_gate;
use crate::services::package_manager::{support, ManagerId, Presence};
use crate::services::tool_run_manager::ClientUpdatePending;
use crate::utils::in_progress::InProgress;
use crate::utils::latch::LatchView;
use managers::{QueryError, UpgradeOutcome};
use state::UpdateState;

const POLL: Duration = Duration::from_secs(60);
const FORCE_QUEUE: usize = 16;

/// What must stop a pass before its next upgrade: the agent is about to be replaced or restarted.
pub struct RestartSignals {
    pub client_update: ClientUpdatePending,
    pub agent_restart: LatchView,
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
    ) -> (Self, ForceNow) {
        let (sender, force) = mpsc::channel(FORCE_QUEUE);
        let worker = Worker {
            store,
            state_path,
            signals,
            package_upgrades,
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
    let mut retry_at: Option<u64> = None;
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
                if retry_at.is_none_or(|at| now >= at)
                    && state.is_due(now, console_logon_id(), &policy)
                {
                    retry_at = worker.pass(&mut state, &mut force).await;
                }
            }
            Wake::PolicyChanged => {
                retry_at = worker.pass(&mut state, &mut force).await;
            }
            Wake::Force((package, reply)) => {
                let result = worker.force(&mut state, &package).await;
                worker.save(&state);
                let _ = reply.send(result);
            }
        }
    }
}

impl Worker {
    async fn force(&self, state: &mut UpdateState, package: &PackageRef) -> ForceResult {
        if !self.store.entries().iter().any(|e| &e.package == package) {
            return ForceResult::NotInPolicy;
        }
        if self.signals.pending() {
            return ForceResult::Unavailable("agent restart pending".to_string());
        }
        let manager = ManagerId::of(package);
        if !support::is_supported(manager) || manager.presence().await != Presence::Present {
            return ForceResult::Unavailable(format!("{manager:?} is not available"));
        }
        match managers::outdated(manager).await {
            Ok(outdated) if !outdated.contains(package) => {
                state.upgraded(package);
                return ForceResult::AlreadyLatest;
            }
            Ok(_) => {}
            Err(QueryError::Unavailable(reason) | QueryError::Failed(reason)) => {
                return ForceResult::Unavailable(reason)
            }
        }
        let prepared = update_gate::prepare(std::slice::from_ref(package)).await;
        let gate = prepared.check_now(package).await;
        let outcome = self.force_upgrade(package, &gate.holder_pids()).await;
        info!(?package, ?outcome, "Forced upgrade");
        if matches!(
            outcome,
            UpgradeOutcome::Upgraded | UpgradeOutcome::AlreadyLatest
        ) {
            state.upgraded(package);
        }
        match outcome {
            UpgradeOutcome::Upgraded => ForceResult::Upgraded,
            UpgradeOutcome::AlreadyLatest => ForceResult::AlreadyLatest,
            UpgradeOutcome::Deferred(reason) => ForceResult::Unavailable(reason),
            UpgradeOutcome::Failed(reason) => ForceResult::Failed(reason),
        }
    }

    async fn force_upgrade(&self, package: &PackageRef, holders: &[u32]) -> UpgradeOutcome {
        let _running = self.package_upgrades.begin();
        close::close(holders).await;
        self.upgrade(package).await
    }

    async fn upgrade(&self, package: &PackageRef) -> UpgradeOutcome {
        let _running = self.package_upgrades.begin();
        managers::upgrade(package).await
    }

    fn save(&self, state: &UpdateState) {
        if let Err(e) = state.save(&self.state_path) {
            error!("Failed to persist auto-update state: {:#}", e);
        }
    }
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs())
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
