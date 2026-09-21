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

        let encoded_machine_id = percent_encode_unreserved(&machine_id);
        let subject = format!("machine.{}.timezone", encoded_machine_id);
        self.nats_publisher.publish_acked(&subject, &bytes).await?;

        info!("Reported timezone '{}' on {}", timezone, subject);
        Ok(())
    }
}

fn percent_encode_unreserved(input: &str) -> String {
    let mut encoded = String::with_capacity(input.len());
    for byte in input.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(*byte as char);
            }
            _ => {
                encoded.push('%');
                encoded.push_str(&format!("{:02X}", byte));
            }
        }
    }
    encoded
}

