use anyhow::Result;
use tracing::{info, warn};

use super::message::{ListConfidence, MachineOsUpdatesMessage, UpdateSet};
use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::payload_limit;

const OS_UPDATES_SUBJECT: &str = "os-updates";

#[derive(Clone)]
pub struct OsUpdatesReportPublisher {
    nats_publisher: NatsMessagePublisher,
    config_service: AgentConfigurationService,
}

impl OsUpdatesReportPublisher {
    pub fn new(
        nats_publisher: NatsMessagePublisher,
        config_service: AgentConfigurationService,
    ) -> Self {
        Self {
            nats_publisher,
            config_service,
        }
    }

    pub async fn publish(&self, mut message: MachineOsUpdatesMessage) -> Result<()> {
        let machine_id = self.config_service.get_machine_id()?;
        let subject = format!("machine.{}.{}", machine_id, OS_UPDATES_SUBJECT);

        let limit = payload_limit(self.nats_publisher.max_payload().await);
        let mut bytes = serde_json::to_vec(&message)?;
        if bytes.len() > limit {
            warn!(
                bytes = bytes.len(),
                limit, "OS updates report is too large, sending it without the update list"
            );
            if let Some(state) = &mut message.state {
                state.updates = UpdateSet {
                    confidence: ListConfidence::TooLarge,
                    items: None,
                };
            }
            bytes = serde_json::to_vec(&message)?;
        }

        self.nats_publisher.publish_acked(&subject, &bytes).await?;

        info!(
            bytes = bytes.len(),
            manageability = ?message.manageability,
            patch_state = ?message.state.as_ref().map(|state| state.patch_state),
            scan_state = ?message.state.as_ref().map(|state| state.scan_state),
            "Reported OS updates on {}",
            subject
        );
        Ok(())
    }
}

#[cfg(test)]
#[path = "report_publisher_tests.rs"]
pub(super) mod tests;
