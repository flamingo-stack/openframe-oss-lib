use std::collections::HashSet;
use std::sync::Arc;

use tracing::{info, warn};

use super::{Begin, CommandHandler, Outcome};
use crate::models::{
    DeliveryRef, FailReason, PackageUpdateMessage, UpdateMode, PACKAGE_UPDATE_DELIVERY_TYPE,
    PACKAGE_UPDATE_KIND,
};
use crate::services::delivery_results::DeliveryResults;
use crate::services::package_manager::package_update::{
    supersede, OrderStore, StatusReporter, Submitted,
};
use crate::services::package_manager::{is_supported, ManagerId};
use crate::services::result_store::now_secs;

const DEFAULT_COUNTDOWN_SECS: u64 = 300;
const MIN_COUNTDOWN_SECS: u64 = 60;
const MAX_COUNTDOWN_SECS: u64 = 1800;

/// Takes update orders in: a stored order is answered once it ends, an unsupported one is refused at once with a
/// FAILED status; the outcome follows on the status stream.
#[derive(Clone)]
pub struct PackageUpdateHandler {
    orders: Arc<OrderStore>,
    status: StatusReporter,
    results: DeliveryResults,
}

impl PackageUpdateHandler {
    pub fn new(orders: Arc<OrderStore>, status: StatusReporter, results: DeliveryResults) -> Self {
        Self {
            orders,
            status,
            results,
        }
    }
}

impl CommandHandler for PackageUpdateHandler {
    type Command = PackageUpdateMessage;
    type Guard = ();

    const KIND: &'static str = PACKAGE_UPDATE_KIND;
    const DEFERRED_TYPE: Option<&'static str> = Some(PACKAGE_UPDATE_DELIVERY_TYPE);

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.{}", machine_id, PACKAGE_UPDATE_KIND)
    }

    fn begin(&self, _command: &Self::Command) -> Begin<()> {
        Begin::Accepted(())
    }

    fn owed_deliveries(&self, machine_id: &str) -> HashSet<String> {
        self.orders
            .pending(machine_id)
            .into_iter()
            .flat_map(|order| order.deliveries)
            .map(|delivery| delivery.dispatch_id)
            .collect()
    }

    async fn run(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        command: Self::Command,
        _guard: (),
    ) -> Outcome {
        let manager = ManagerId::of(&command.package);
        if !is_supported(manager) {
            self.status
                .report_rejected(
                    machine_id,
                    &command,
                    FailReason::NotSupported,
                    format!("{manager:?} is not supported on this device"),
                )
                .await;
            return Outcome::Done;
        }
        let countdown = countdown_for(&command);
        match self
            .orders
            .submit(machine_id, delivery.clone(), now_secs(), command, countdown)
        {
            Ok(Submitted::Accepted) => Outcome::Deferred,
            Ok(Submitted::Attached) => {
                info!(sequence = ?delivery.sequence, "Package update order sent again, answered with the pending one");
                Outcome::Deferred
            }
            Ok(Submitted::AlreadyFailed) => Outcome::Failed(
                "the order of this dispatch already failed; its re-run comes under a new dispatch"
                    .to_string(),
            ),
            Ok(Submitted::Stale) => {
                info!(sequence = ?delivery.sequence, "Stale package update order, already applied");
                Outcome::Done
            }
            Ok(Submitted::Superseded(old)) => {
                info!(request_id = %old.request_id, "Package update order superseded by a newer request");
                supersede(&self.status, &self.results, machine_id, old).await;
                Outcome::Deferred
            }
            Err(e) => Outcome::Failed(format!("{e:#}")),
        }
    }
}

/// The countdown a FORCE order runs with: the contract's range, zero only for the user's own click.
fn countdown_for(command: &PackageUpdateMessage) -> u64 {
    if command.mode == UpdateMode::Wait {
        return 0;
    }
    match command.countdown_seconds {
        None => DEFAULT_COUNTDOWN_SECS,
        Some(0) if command.source.is_user() => 0,
        Some(requested) => {
            let countdown = requested.clamp(MIN_COUNTDOWN_SECS, MAX_COUNTDOWN_SECS);
            if countdown != requested {
                warn!(
                    request_id = %command.request_id,
                    requested,
                    countdown,
                    "Countdown outside the allowed range, clamped"
                );
            }
            countdown
        }
    }
}

#[cfg(test)]
#[path = "package_update_tests.rs"]
mod tests;
