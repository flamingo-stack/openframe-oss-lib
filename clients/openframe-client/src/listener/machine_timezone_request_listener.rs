use anyhow::{anyhow, Result};
use futures::StreamExt;
use tokio::time::{timeout, Duration};
use tracing::{error, info, warn};

use crate::config::update_config::{FLUSH_PUBLISH_TIMEOUT_SECS, RECONNECTION_DELAY_MS};
use crate::models::MachineTimezoneMessage;
use crate::services::device_data_fetcher::DeviceDataFetcher;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::AgentConfigurationService;

#[derive(Clone)]
pub struct MachineTimezoneRequestListener {
    nats_connection_manager: NatsConnectionManager,
    nats_message_publisher: NatsMessagePublisher,
    config_service: AgentConfigurationService,
    device_data_fetcher: DeviceDataFetcher,
}

impl MachineTimezoneRequestListener {
    pub fn new(
        nats_connection_manager: NatsConnectionManager,
        nats_message_publisher: NatsMessagePublisher,
        config_service: AgentConfigurationService,
        device_data_fetcher: DeviceDataFetcher,
    ) -> Self {
        Self {
            nats_connection_manager,
            nats_message_publisher,
            config_service,
            device_data_fetcher,
        }
    }

    pub async fn start(&self) -> Result<tokio::task::JoinHandle<()>> {
        let listener = self.clone();
        let handle = tokio::spawn(async move {
            loop {
                info!("Starting machine timezone request listener...");
                match listener.listen().await {
                    Ok(_) => {
                        warn!("Machine timezone request subscription closed");
                    }
                    Err(e) => {
                        error!("Machine timezone request listener error: {:#}", e);
                    }
                }

                info!(
                    "Resubscribing to machine timezone requests in {} seconds...",
                    RECONNECTION_DELAY_MS / 1000
                );
                tokio::time::sleep(Duration::from_millis(RECONNECTION_DELAY_MS)).await;
            }
        });
        Ok(handle)
    }

    pub async fn report_once(&self) {
        match self.config_service.get_machine_id() {
            Ok(machine_id) => {
                self.report(&format!("machine.{}.timezone", machine_id))
                    .await
            }
            Err(e) => error!("Failed to resolve machine id for timezone report: {:#}", e),
        }
    }

    async fn listen(&self) -> Result<()> {
        let client = self.nats_connection_manager.get_client().await?;
        let machine_id = self.config_service.get_machine_id()?;

        let request_subject = format!("machine.{}.timezone.request", machine_id);
        let mut subscriber = client
            .subscribe(request_subject.clone())
            .await
            .map_err(|e| anyhow!("failed to subscribe to {}: {}", request_subject, e))?;

        info!(subject = %request_subject, "Machine timezone request listener active");

        let report_subject = format!("machine.{}.timezone", machine_id);
        while subscriber.next().await.is_some() {
            self.report(&report_subject).await;
        }

        Ok(())
    }

    async fn report(&self, subject: &str) {
        let Some(timezone) = self.device_data_fetcher.get_timezone() else {
            warn!("Could not resolve system timezone - skipping timezone report");
            return;
        };

        let message = MachineTimezoneMessage { timezone };
        let bytes = match serde_json::to_vec(&message) {
            Ok(bytes) => bytes,
            Err(e) => {
                error!("Failed to serialize timezone report: {:#}", e);
                return;
            }
        };

        let publish = self.nats_message_publisher.publish_acked(subject, &bytes);
        match timeout(Duration::from_secs(FLUSH_PUBLISH_TIMEOUT_SECS), publish).await {
            Ok(Ok(())) => info!("Reported timezone '{}' on {}", message.timezone, subject),
            Ok(Err(e)) => error!("Failed to publish timezone report: {:#}", e),
            Err(_) => error!("Timezone report publish timed out on {}", subject),
        }
    }
}
