use anyhow::Result;
use tracing::{info, warn};

use crate::models::OsInfoReportMessage;
use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::device_data_fetcher::DeviceDataFetcher;
use crate::services::nats_message_publisher::NatsMessagePublisher;

#[derive(Clone)]
pub struct OsInfoReportPublisher {
    nats_publisher: NatsMessagePublisher,
    config_service: AgentConfigurationService,
    device_data_fetcher: DeviceDataFetcher,
}

impl OsInfoReportPublisher {
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
            warn!("Failed to publish OS info report: {:#}", e);
        }
    }

    async fn try_publish(&self) -> Result<()> {
        let os = self.device_data_fetcher.get_os_version();
        let Some(os_version) = os.version else {
            warn!("Could not resolve the OS version - skipping OS info report");
            return Ok(());
        };
        let machine_id = self.config_service.get_machine_id()?;
        let subject = format!("machine.{}.os-info", machine_id);
        let message = OsInfoReportMessage {
            os_version,
            os_build: os.build,
        };
        self.nats_publisher.publish(&subject, &message).await?;
        info!(?message, "Reported OS info on {}", subject);
        Ok(())
    }
}

#[cfg(test)]
#[path = "os_info_report_publisher_tests.rs"]
mod tests;
