use tokio::time::{sleep, Duration};
use tracing::{info, warn};

use super::RestartGate;
use crate::config::update_config::SELF_RESTART_IDLE_POLL_SECS;
use crate::platform::{in_flight_client_update_phase, updater_drain_request, write_drained_marker};

/// Answers openframe-client-updater's drain request: the gate holds new commands and waits for
/// running work as for a restart, then a marker tells the updater it may stop this process.
pub async fn follow_updater_drains(gate: RestartGate) {
    let mut drained: Option<String> = None;
    loop {
        if let Some(token) = updater_drain_request() {
            if drained.as_deref() != Some(token.as_str()) {
                gate.drain_for_update().await;
                match write_drained_marker(&token) {
                    Ok(()) => info!("Drained for the client update, the updater may stop the client"),
                    Err(e) => warn!(
                        "Failed to confirm the drain, the updater stops the client after its own wait: {:#}",
                        e
                    ),
                }
                drained = Some(token);
            }
        } else if in_flight_client_update_phase().is_none() && drained.take().is_some() {
            gate.release_after_update();
        }
        sleep(Duration::from_secs(SELF_RESTART_IDLE_POLL_SECS)).await;
    }
}
