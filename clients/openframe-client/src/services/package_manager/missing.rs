use super::{ManagerId, Presence};
use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use anyhow::Result;
use serde::Serialize;
use tokio::time::{interval, timeout, Duration};
use tracing::{error, info};

const MISSING_CHECK_INTERVAL: Duration = Duration::from_secs(300);
const MISSING_CHECK_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PackageManagerMissingMessage {
    package_manager: ManagerId,
}

#[derive(Clone)]
pub struct PackageManagerMissingPublisher {
    nats_publisher: NatsMessagePublisher,
    config_service: AgentConfigurationService,
}

impl PackageManagerMissingPublisher {
    pub fn new(
        nats_publisher: NatsMessagePublisher,
        config_service: AgentConfigurationService,
    ) -> Self {
        Self {
            nats_publisher,
            config_service,
        }
    }

    pub async fn publish_missing(&self) -> Result<()> {
        let machine_id = self.config_service.get_machine_id()?;
        let subject = format!("machine.{}.package-manager-missing", machine_id);

        for id in ManagerId::for_current_platform() {
            if id.presence() != Presence::Absent {
                continue;
            }
            self.nats_publisher
                .publish(
                    &subject,
                    PackageManagerMissingMessage {
                        package_manager: *id,
                    },
                )
                .await?;
            info!(manager = ?id, "Reported missing package manager");
        }
        Ok(())
    }
}

pub struct PackageManagerMissingRunManager {
    publisher: PackageManagerMissingPublisher,
}

impl PackageManagerMissingRunManager {
    pub fn new(publisher: PackageManagerMissingPublisher) -> Self {
        Self { publisher }
    }

    pub fn start(&self) {
        let publisher = self.publisher.clone();

        info!("Starting package manager missing run manager");

        tokio::spawn(async move {
            let mut ticker = interval(MISSING_CHECK_INTERVAL);

            loop {
                ticker.tick().await;

                match timeout(MISSING_CHECK_TIMEOUT, publisher.publish_missing()).await {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => error!("Failed to report missing package managers: {}", e),
                    Err(_) => error!("Package manager missing report timed out"),
                }
            }
        });
    }
}
