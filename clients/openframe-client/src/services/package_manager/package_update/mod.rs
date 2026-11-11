mod close;
mod machine;
mod managers;
mod orders;
mod relaunch;
mod run;
mod status;

pub use orders::{Ending, Order, OrderStore, Submitted};
pub use status::StatusReporter;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tokio::task::JoinHandle;
use tracing::{info, warn};

use crate::models::{DeliveryRef, DeliveryResultMessage};
use crate::services::delivery_results::DeliveryResults;
use crate::services::tool_run_manager::ClientUpdatePending;
use crate::services::AgentConfigurationService;
use crate::utils::in_progress::InProgress;
use crate::utils::latch::LatchView;
use machine::{Machine, System};
use run::{Progress, Verdict, POLL_SECS};

/// What must hold an install back: the agent is about to be replaced or restarted.
pub struct RestartSignals {
    pub client_update: ClientUpdatePending,
    pub agent_restart: LatchView,
}

impl RestartSignals {
    fn pending(&self) -> bool {
        self.client_update.is_pending() || self.agent_restart.is_set()
    }
}

/// Runs the pending update orders one install at a time and reports every change of state.
pub struct PackageUpdateRunManager {
    worker: Arc<Worker>,
    started: AtomicBool,
}

struct Worker {
    machine: Box<dyn Machine>,
    orders: Arc<OrderStore>,
    status: StatusReporter,
    results: DeliveryResults,
    config: AgentConfigurationService,
    signals: RestartSignals,
    package_upgrades: InProgress,
}

impl PackageUpdateRunManager {
    pub fn new(
        orders: Arc<OrderStore>,
        status: StatusReporter,
        results: DeliveryResults,
        config: AgentConfigurationService,
        signals: RestartSignals,
        package_upgrades: InProgress,
    ) -> Self {
        Self {
            worker: Arc::new(Worker {
                machine: Box::new(System),
                orders,
                status,
                results,
                config,
                signals,
                package_upgrades,
            }),
            started: AtomicBool::new(false),
        }
    }

    pub fn start(&self) -> Option<JoinHandle<()>> {
        if self.started.swap(true, Ordering::AcqRel) {
            warn!("Package update worker already started");
            return None;
        }
        info!("Starting package update worker");
        Some(tokio::spawn(run(self.worker.clone())))
    }
}

async fn run(worker: Arc<Worker>) {
    let mut progress: HashMap<String, Progress> = HashMap::new();
    loop {
        let machine_id = match worker.config.get_machine_id() {
            Ok(machine_id) => machine_id,
            Err(e) => {
                warn!("Package updates wait for a machine id: {:#}", e);
                tokio::time::sleep(Duration::from_secs(POLL_SECS)).await;
                continue;
            }
        };
        let pending = worker.orders.pending(&machine_id);
        let abandoned: Vec<String> = progress
            .keys()
            .filter(|id| !pending.iter().any(|o| &o.request_id == *id))
            .cloned()
            .collect();
        for request_id in abandoned {
            if let Some(p) = progress.remove(&request_id) {
                worker.abandon(&request_id, p).await;
            }
        }
        if pending.is_empty() {
            worker.orders.changed().await;
            continue;
        }

        let now = unix_now();
        let mut next_wake = now + POLL_SECS;
        for order in &pending {
            if worker.signals.pending() {
                info!("Agent restart pending, package updates resume after it");
                break;
            }
            let p = progress.entry(order.request_id.clone()).or_default();
            // A re-sent order is looked at at once, whatever its schedule.
            if p.next_at > now && p.revision == Some(order.revision) {
                next_wake = next_wake.min(p.next_at);
                continue;
            }
            // Re-read the order: an earlier install in this round may have taken minutes.
            let Some(current) = worker.orders.get(&order.request_id) else {
                continue;
            };
            match worker.look(&machine_id, &current, p, unix_now()).await {
                Verdict::Continue { next_at } => {
                    p.next_at = next_at;
                    next_wake = next_wake.min(next_at);
                }
                Verdict::Finished(ending) => {
                    progress.remove(&current.request_id);
                    let deliveries = worker.orders.finish(&current.request_id, &ending);
                    answer(&worker.results, &machine_id, deliveries, &ending).await;
                }
            }
        }

        let delay = Duration::from_secs(next_wake.saturating_sub(unix_now()).max(1));
        tokio::select! {
            _ = worker.orders.changed() => {}
            _ = tokio::time::sleep(delay) => {}
        }
    }
}

/// A newer request for the same package replaced `old`: its status says so and every dispatch it collected is done.
pub async fn supersede(
    status: &StatusReporter,
    results: &DeliveryResults,
    machine_id: &str,
    old: Order,
) {
    status.report_superseded(machine_id, &old).await;
    answer(results, machine_id, old.deliveries, &Ending::Done).await;
}

/// Answers every dispatch an ended order collected: FAILED when a re-run may fix it, DONE otherwise.
async fn answer(
    results: &DeliveryResults,
    machine_id: &str,
    deliveries: Vec<DeliveryRef>,
    ending: &Ending,
) {
    for delivery in deliveries {
        let message = match ending {
            Ending::Done => DeliveryResultMessage::done(delivery),
            Ending::Retry { reason, message } => {
                DeliveryResultMessage::failed(delivery, format!("{}: {message}", reason.name()))
            }
        };
        results.settle(machine_id, message).await;
    }
}

fn unix_now() -> u64 {
    crate::services::result_store::now_secs()
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "end_to_end_tests.rs"]
mod end_to_end_tests;
