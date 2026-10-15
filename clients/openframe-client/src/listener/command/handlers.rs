use std::sync::Arc;

use anyhow::Result;
use tracing::info;

use super::{CommandHandler, Outcome};
use crate::models::{DeliveryRef, FeatureFlagsMessage};
use crate::services::feature_flags_service::{FeatureFlagsService, FlagsApplied};

#[derive(Clone)]
pub struct FeatureFlagsHandler {
    service: Arc<FeatureFlagsService>,
}

impl FeatureFlagsHandler {
    pub fn new(service: Arc<FeatureFlagsService>) -> Self {
        Self { service }
    }
}

impl CommandHandler for FeatureFlagsHandler {
    type Command = FeatureFlagsMessage;

    const KIND: &'static str = "feature-flags";

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.feature-flags", machine_id)
    }

    async fn run(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        command: Self::Command,
    ) -> Outcome {
        let Some(sequence) = delivery.sequence else {
            return Outcome::Failed("feature flags without a sequence".to_string());
        };
        let applied_sequence = self.service.applied_sequence(machine_id);
        if sequence <= applied_sequence {
            info!(
                sequence,
                applied_sequence, "Stale feature flags, already applied a newer set"
            );
            return Outcome::Done;
        }
        match self.service.apply(machine_id, delivery, sequence, command) {
            Ok(FlagsApplied::Unchanged) => Outcome::Done,
            Ok(FlagsApplied::RestartRequired) => Outcome::RestartRequired,
            Err(e) => Outcome::Failed(format!("{e:#}")),
        }
    }

    fn awaiting_restart(&self) -> Option<DeliveryRef> {
        self.service.awaiting_restart()
    }

    fn restart_reported(&self) -> Result<()> {
        self.service.restart_reported()
    }
}

#[cfg(test)]
#[path = "handlers_tests.rs"]
mod tests;
