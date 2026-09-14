use crate::config::update_config::{
    CONSUMER_ACK_WAIT_SECS, CONSUMER_MAX_DELIVER, FLUSH_PUBLISH_TIMEOUT_SECS, RECONNECTION_DELAY_MS,
};
use crate::models::MachineTimezoneMessage;
use crate::services::device_data_fetcher::DeviceDataFetcher;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::AgentConfigurationService;
use anyhow::Result;
use async_nats::jetstream;
use async_nats::jetstream::consumer::{push, DeliverPolicy};
use async_nats::jetstream::Message;
use futures::StreamExt;
use tokio::time::{timeout, Duration};
use tracing::{error, info, warn};

#[derive(Clone)]
pub struct MachineTimezoneRequestListener {
    nats_connection_manager: NatsConnectionManager,
    nats_message_publisher: NatsMessagePublisher,
    config_service: AgentConfigurationService,
    device_data_fetcher: DeviceDataFetcher,
}

impl MachineTimezoneRequestListener {
    const STREAM_NAME: &'static str = "MACHINE_TIMEZONE_REQUEST";

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
                    Ok(_) => warn!("Machine timezone request subscription closed"),
                    Err(e) => error!("Machine timezone request listener error: {:#}", e),
                }

                info!(
                    "Rebinding machine timezone request consumer in {} seconds...",
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
                    .await;
            }
            Err(e) => error!("Failed to resolve machine id for timezone report: {:#}", e),
        }
    }

    async fn listen(&self) -> Result<()> {
        let machine_id = self.config_service.get_machine_id()?;
        let client = self.nats_connection_manager.get_client().await?;
        let js = jetstream::new((*client).clone());

        let consumer = js
            .create_consumer_on_stream(Self::consumer_config(&machine_id), Self::STREAM_NAME)
            .await?;

        let report_subject = format!("machine.{}.timezone", machine_id);
        info!(subject = %report_subject, "Machine timezone request listener active");

        let mut messages = consumer.messages().await?;
        while let Some(message) = messages.next().await {
            let message = message.map_err(|e| anyhow::anyhow!("message stream error: {}", e))?;
            self.handle_message(message, &report_subject).await;
        }

        Ok(())
    }

    async fn handle_message(&self, message: Message, report_subject: &str) {
        if self.report(report_subject).await {
            if let Err(e) = message.ack().await {
                warn!("Failed to ack timezone request: {:#}", e);
            }
        } else {
            warn!("Timezone report failed, leaving request unacked for redelivery");
        }
    }

    async fn report(&self, subject: &str) -> bool {
        let Some(timezone) = self.device_data_fetcher.get_timezone() else {
            warn!("Could not resolve system timezone - skipping timezone report");
            return false;
        };

        let message = MachineTimezoneMessage { timezone };
        let bytes = match serde_json::to_vec(&message) {
            Ok(bytes) => bytes,
            Err(e) => {
                error!("Failed to serialize timezone report: {:#}", e);
                return false;
            }
        };

        let publish = self.nats_message_publisher.publish_acked(subject, &bytes);
        match timeout(Duration::from_secs(FLUSH_PUBLISH_TIMEOUT_SECS), publish).await {
            Ok(Ok(())) => {
                info!("Reported timezone '{}' on {}", message.timezone, subject);
                true
            }
            Ok(Err(e)) => {
                error!("Failed to publish timezone report: {:#}", e);
                false
            }
            Err(_) => {
                error!("Timezone report publish timed out on {}", subject);
                false
            }
        }
    }

    fn consumer_config(machine_id: &str) -> push::Config {
        push::Config {
            filter_subject: format!("machine.{}.timezone.request", machine_id),
            deliver_subject: format!("machine.{}.timezone.request.inbox", machine_id),
            durable_name: Some(format!("machine_{}_timezone-request_consumer", machine_id)),
            ack_wait: Duration::from_secs(CONSUMER_ACK_WAIT_SECS),
            deliver_policy: DeliverPolicy::New,
            max_deliver: CONSUMER_MAX_DELIVER,
            ..Default::default()
        }
    }
}
