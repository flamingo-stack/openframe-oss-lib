use crate::models::MachineTimezoneMessage;
use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use anyhow::Result;
use tracing::info;

#[derive(Clone)]
pub struct MachineTimezonePublisher {
    nats_publisher: NatsMessagePublisher,
    config_service: AgentConfigurationService,
}

impl MachineTimezonePublisher {
    pub fn new(
        nats_publisher: NatsMessagePublisher,
        config_service: AgentConfigurationService,
    ) -> Self {
        Self {
            nats_publisher,
            config_service,
        }
    }

    pub async fn publish_timezone(&self, timezone: &str) -> Result<()> {
        let machine_id = self.config_service.get_machine_id()?;

        let message = MachineTimezoneMessage {
            timezone: timezone.to_string(),
        };
        let bytes = serde_json::to_vec(&message)?;

        let subject = format!("machine.{}.timezone", machine_id);
        self.nats_publisher.publish_acked(&subject, &bytes).await?;

        info!("Reported timezone '{}' on {}", timezone, subject);
        Ok(())
    }
}
