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
            work: Arc::new(RwLock::new(())),
            requested: Arc::new(Notify::new()),
            busy_tools,
            running_scripts,
            client_update,
        }
    }

    pub(super) fn admit(&self) -> Option<OwnedRwLockReadGuard<()>> {
        let admitted = self.work.clone().try_read_owned().ok()?;
        if self.closing.load(Ordering::Acquire) {
            return None;
        }
        Some(admitted)
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
        // A running client update restarts the client itself; stopping the service under it could
        // interrupt the binary swap. With a tool still busy the update is only deferred and keeps
        // re-marking the flag on redelivery, so it is not worth waiting for.
        while self.client_update.is_pending() && !self.busy_tools.any() {
            sleep(Duration::from_secs(SELF_RESTART_IDLE_POLL_SECS)).await;
        }
        self.requested.notify_one();
    }

    fn busy(&self) -> bool {
        self.busy_tools.any() || self.running_scripts.any() || self.client_update.is_pending()
    }

    pub async fn requested(&self) {
        self.requested.notified().await;
    }
}

#[cfg(test)]
#[path = "restart_tests.rs"]
mod tests;
