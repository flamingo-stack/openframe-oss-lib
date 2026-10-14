use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tokio::sync::{Notify, OwnedRwLockReadGuard, RwLock};
use tokio::time::{sleep, timeout_at, Duration, Instant};
use tracing::{info, warn};

use crate::config::update_config::{SELF_RESTART_IDLE_POLL_SECS, SELF_RESTART_IDLE_WAIT_SECS};
use crate::services::tool_ops::ToolOps;
use crate::services::tool_run_manager::ToolRunManager;

#[derive(Clone)]
pub(super) struct RestartGate {
    closing: Arc<AtomicBool>,
    work: Arc<RwLock<()>>,
    requested: Arc<Notify>,
    tool_ops: ToolOps,
    tool_run_manager: ToolRunManager,
}

impl RestartGate {
    pub(super) fn new(tool_ops: ToolOps, tool_run_manager: ToolRunManager) -> Self {
        Self {
            closing: Arc::new(AtomicBool::new(false)),
            work: Arc::new(RwLock::new(())),
            requested: Arc::new(Notify::new()),
            tool_ops,
            tool_run_manager,
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
        while self.busy().await && Instant::now() < deadline {
            sleep(Duration::from_secs(SELF_RESTART_IDLE_POLL_SECS)).await;
        }
        if self.busy().await {
            warn!(
                "Tool operation or client update still running after {}s, restarting anyway",
                SELF_RESTART_IDLE_WAIT_SECS
            );
        }
        self.requested.notify_one();
    }

    async fn busy(&self) -> bool {
        self.tool_ops.any_busy() || self.tool_run_manager.is_client_update_pending().await
    }

    pub(super) async fn requested(&self) {
        self.requested.notified().await;
    }
}

#[cfg(test)]
#[path = "restart_tests.rs"]
mod tests;
