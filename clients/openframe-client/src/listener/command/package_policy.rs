use std::sync::Arc;

use tracing::info;

use super::{CommandHandler, Outcome};
use crate::models::{DeliveryRef, PackagePolicyMessage};
use crate::services::package_manager::auto_update::PolicyStore;

#[derive(Clone)]
pub struct PackagePolicyHandler {
    store: Arc<PolicyStore>,
}

impl PackagePolicyHandler {
    pub fn new(store: Arc<PolicyStore>) -> Self {
        Self { store }
    }
}

impl CommandHandler for PackagePolicyHandler {
    type Command = PackagePolicyMessage;

    const KIND: &'static str = "package-policy";

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.package-policy", machine_id)
    }

    async fn run(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        command: Self::Command,
    ) -> Outcome {
        let Some(sequence) = delivery.sequence else {
            return Outcome::Failed("package policy without a sequence".to_string());
        };
        let applied_sequence = self.store.applied_sequence(machine_id);
        if sequence <= applied_sequence {
            info!(
                sequence,
                applied_sequence, "Stale package policy, already applied a newer one"
            );
            return Outcome::Done;
        }
        match self.store.apply(machine_id, sequence, command.packages) {
            Ok(()) => Outcome::Done,
            Err(e) => Outcome::Failed(format!("{e:#}")),
        }
    }
}

#[cfg(test)]
#[path = "package_policy_tests.rs"]
mod tests;
