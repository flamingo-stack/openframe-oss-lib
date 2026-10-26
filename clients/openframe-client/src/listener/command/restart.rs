use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tokio::sync::{Notify, OwnedRwLockReadGuard, RwLock};
use tokio::time::{sleep, timeout_at, Duration, Instant};
use tracing::{info, warn};

use crate::config::update_config::{SELF_RESTART_IDLE_POLL_SECS, SELF_RESTART_IDLE_WAIT_SECS};
use crate::services::execution_service::RunningScripts;
use crate::services::tool_ops::BusyTools;
use crate::services::tool_run_manager::ClientUpdatePending;

#[derive(Clone)]
pub struct RestartGate {
    closing: Arc<AtomicBool>,
    // set while openframe-client-updater waits to stop this process for a swap; released if it never does
    held_for_update: Arc<AtomicBool>,
    work: Arc<RwLock<()>>,
    requested: Arc<Notify>,
    busy_tools: BusyTools,
    running_scripts: RunningScripts,
    client_update: ClientUpdatePending,
}

impl RestartGate {
    pub fn new(
        busy_tools: BusyTools,
        running_scripts: RunningScripts,
        client_update: ClientUpdatePending,
    ) -> Self {
        Self {
            closing: Arc::new(AtomicBool::new(false)),
            held_for_update: Arc::new(AtomicBool::new(false)),
            work: Arc::new(RwLock::new(())),
            requested: Arc::new(Notify::new()),
            busy_tools,
            running_scripts,
            client_update,
        }
    }

    pub(super) fn admit(&self) -> Option<OwnedRwLockReadGuard<()>> {
        let admitted = self.work.clone().try_read_owned().ok()?;
        if self.closing.load(Ordering::Acquire) || self.held_for_update.load(Ordering::Acquire) {
            return None;
        }
        Some(admitted)
    }

    /// A client update is a restart onto a new binary: no new commands are taken and running
    /// work gets the same time a restart gives it, then the updater may stop this process.
    pub(super) async fn drain_for_update(&self) {
        self.held_for_update.store(true, Ordering::Release);
        let deadline = Instant::now() + Duration::from_secs(SELF_RESTART_IDLE_WAIT_SECS);
        info!(
            "Client update pending: no new commands are taken, waiting for running ones to finish"
        );

        if timeout_at(deadline, self.work.write()).await.is_err() {
            warn!(
                "Commands still running after {}s, letting the update go ahead",
                SELF_RESTART_IDLE_WAIT_SECS
            );
        }
        while self.work_running() && Instant::now() < deadline {
            sleep(Duration::from_secs(SELF_RESTART_IDLE_POLL_SECS)).await;
        }
        if self.work_running() {
            warn!(
                "Tool operation or script still running after {}s, letting the update go ahead",
                SELF_RESTART_IDLE_WAIT_SECS
            );
        }
    }

    /// The update ended without stopping this process: commands are taken again.
    pub(super) fn release_after_update(&self) {
        if self.held_for_update.swap(false, Ordering::AcqRel) {
            info!("Client update no longer pending, taking commands again");
        }
    }

    pub(super) async fn drain_and_request(&self) {
        self.closing.store(true, Ordering::Release);
        let deadline = Instant::now() + Duration::from_secs(SELF_RESTART_IDLE_WAIT_SECS);
        info!("Restart scheduled: no new commands are taken, waiting for running ones to finish");

        if timeout_at(deadline, self.work.write()).await.is_err() {
            warn!(
                "Commands still running after {}s, restarting anyway",
                SELF_RESTART_IDLE_WAIT_SECS
            );
        }
        while self.busy() && Instant::now() < deadline {
            sleep(Duration::from_secs(SELF_RESTART_IDLE_POLL_SECS)).await;
        }
        if self.busy() {
            warn!(
                "Tool operation, script or client update still running after {}s, restarting anyway",
                SELF_RESTART_IDLE_WAIT_SECS
            );
        }
        // A client update in flight stops and swaps this client itself; restarting under it could
        // interrupt the swap. With a tool still busy the updater is still waiting for the drain, and
        // the restarted client drains for it again, so the restart goes ahead.
        while self.client_update.is_pending() && !self.busy_tools.any() {
            sleep(Duration::from_secs(SELF_RESTART_IDLE_POLL_SECS)).await;
        }
        self.requested.notify_one();
    }

    fn busy(&self) -> bool {
        self.work_running() || self.client_update.is_pending()
    }

    fn work_running(&self) -> bool {
        self.busy_tools.any() || self.running_scripts.any()
    }

    pub async fn requested(&self) {
        self.requested.notified().await;
    }
}

#[cfg(test)]
#[path = "restart_tests.rs"]
mod tests;
