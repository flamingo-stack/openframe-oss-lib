use anyhow::Result;
use tracing::{info, warn};

use crate::models::HostnameReportMessage;
use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::device_data_fetcher::DeviceDataFetcher;
use crate::services::nats_message_publisher::NatsMessagePublisher;

/// Reports the machine's current hostname once per client startup so a renamed
/// device resyncs without reinstalling. Stateless by design: the backend owns
/// the old-vs-new comparison, so a lost report self-heals at the next startup
/// and plain core-NATS publish is enough.
#[derive(Clone)]
pub struct HostnameReportPublisher {
    nats_publisher: NatsMessagePublisher,
    config_service: AgentConfigurationService,
    device_data_fetcher: DeviceDataFetcher,
}

impl HostnameReportPublisher {
    pub fn new(
        nats_publisher: NatsMessagePublisher,
        config_service: AgentConfigurationService,
        device_data_fetcher: DeviceDataFetcher,
    ) -> Self {
        Self {
            nats_publisher,
            config_service,
            device_data_fetcher,
        }
    }

    pub async fn publish(&self) {
        if let Err(e) = self.try_publish().await {
            warn!("Failed to publish hostname report: {:#}", e);
        }
    }

    async fn try_publish(&self) -> Result<()> {
        let Some(hostname) = self.device_data_fetcher.get_hostname() else {
            warn!("Could not resolve hostname - skipping hostname report");
            return Ok(());
        };

        let machine_id = self.config_service.get_machine_id()?;
        let message = HostnameReportMessage {
            hostname: hostname.clone(),
        };

        let subject = format!("machine.{}.hostname", machine_id);
        self.nats_publisher.publish(&subject, &message).await?;
        info!("Reported hostname '{}' on {}", hostname, subject);
        Ok(())
    }
}
