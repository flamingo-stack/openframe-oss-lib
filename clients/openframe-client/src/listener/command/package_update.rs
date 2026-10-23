use std::sync::Arc;

use tracing::{info, warn};

use super::{Begin, CommandHandler, Outcome};
use crate::models::{DeliveryRef, PackageUpdateMessage, UpdateMode, PACKAGE_UPDATE_KIND};
use crate::services::package_manager::package_update::{OrderStore, StatusReporter, Submitted};
use crate::services::package_manager::{is_supported, ManagerId};
use crate::services::result_store::now_secs;

const DEFAULT_COUNTDOWN_SECS: u64 = 300;
const MIN_COUNTDOWN_SECS: u64 = 60;
const MAX_COUNTDOWN_SECS: u64 = 1800;

/// Takes update orders in: DONE once the order is on disk, the outcome follows on the status stream.
#[derive(Clone)]
pub struct PackageUpdateHandler {
    orders: Arc<OrderStore>,
    status: StatusReporter,
}

impl PackageUpdateHandler {
    pub fn new(orders: Arc<OrderStore>, status: StatusReporter) -> Self {
        Self { orders, status }
    }
}

impl CommandHandler for PackageUpdateHandler {
    type Command = PackageUpdateMessage;
    type Guard = ();

    const KIND: &'static str = PACKAGE_UPDATE_KIND;

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.{}", machine_id, PACKAGE_UPDATE_KIND)
    }

    fn begin(&self, _command: &Self::Command) -> Begin<()> {
        Begin::Accepted(())
    }

    async fn run(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        command: Self::Command,
        _guard: (),
    ) -> Outcome {
        let Some(sequence) = delivery.sequence else {
            return Outcome::Failed("package update without a sequence".to_string());
        };
        let manager = ManagerId::of(&command.package);
        if !is_supported(manager) {
            return Outcome::Failed(format!("{manager:?} is not supported on this device"));
        }
        let countdown = countdown_for(&command);
        match self
            .orders
            .submit(machine_id, sequence, now_secs(), command, countdown)
        {
            Ok(Submitted::Accepted) => Outcome::Done,
            Ok(Submitted::Stale) => {
                info!(sequence, "Stale package update order, already applied");
                Outcome::Done
            }
            Ok(Submitted::Superseded(old)) => {
                info!(request_id = %old.request_id, "Package update order superseded by a newer request");
                self.status.report_superseded(machine_id, &old).await;
                Outcome::Done
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
