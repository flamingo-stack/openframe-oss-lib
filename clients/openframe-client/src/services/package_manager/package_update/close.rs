use std::time::{Duration, Instant};

use tracing::{info, warn};

use crate::platform::{app_close, process_snapshot};
use crate::services::tool_kill_service::ToolKillService;

pub(super) const CLOSE_GRACE: Duration = Duration::from_secs(10);

/// Asks the holders to close, stops what ignores the request, and returns what survived even that.
pub(super) async fn close(holders: &[u32]) -> Vec<u32> {
    if holders.is_empty() {
        return Vec::new();
    }
    app_close::ask_to_close(holders).await;
    let asked = Instant::now();
    let deadline = asked + CLOSE_GRACE;
    let mut alive = still_running(holders).await;
    while !alive.is_empty() && Instant::now() < deadline {
        tokio::time::sleep(Duration::from_millis(500)).await;
        alive = still_running(holders).await;
    }
    info!(
        ?holders,
        closed_on_request = holders.len() - alive.len(),
        stopping = ?alive,
        waited = ?asked.elapsed(),
        "Asked the apps holding a forced upgrade to close"
    );
    for pid in &alive {
        if let Err(e) = ToolKillService::new()
            .stop_process(*pid, "forced package upgrade")
            .await
        {
            warn!(
                pid,
                "Could not stop an app before its forced upgrade: {:#}", e
            );
        }
    }
    if alive.is_empty() {
        return alive;
    }
    tokio::time::sleep(Duration::from_millis(500)).await;
    still_running(&alive).await
}

async fn still_running(pids: &[u32]) -> Vec<u32> {
    let pids = pids.to_vec();
    tokio::task::spawn_blocking(move || process_snapshot::alive(&pids))
        .await
        .unwrap_or_default()
}

#[cfg(test)]
#[path = "close_tests.rs"]
mod tests;
