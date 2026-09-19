use super::{ManagerId, Presence, PRESENCE_PROBE_TIMEOUT_SECS};
use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use anyhow::{anyhow, Result};
use serde::Serialize;
use tokio::time::{interval, timeout, Duration};
use tracing::{error, info};

const PACKAGE_MANAGER_MISSING_SUBJECT: &str = "package-manager-missing";
const PRESENCE_REPORT_INTERVAL: Duration = Duration::from_secs(300);
const PUBLISH_GRACE: Duration = Duration::from_secs(10);

fn report_timeout() -> Duration {
    let probes = ManagerId::for_current_platform().len().max(1) as u64;
    Duration::from_secs(u64::from(PRESENCE_PROBE_TIMEOUT_SECS) * probes) + PUBLISH_GRACE
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PackageManagerMissingMessage {
    package_manager: ManagerId,
}

#[derive(Clone)]
pub struct PackageManagerPresenceReporter {
    nats_publisher: NatsMessagePublisher,
    config_service: AgentConfigurationService,
}

impl PackageManagerPresenceReporter {
    pub fn new(
        nats_publisher: NatsMessagePublisher,
        config_service: AgentConfigurationService,
    ) -> Self {
        Self {
            nats_publisher,
            config_service,
        }
    }

    pub async fn report_presence(&self) -> Result<()> {
        let machine_id = self.config_service.get_machine_id()?;
        let subject = format!("machine.{}.{}", machine_id, PACKAGE_MANAGER_MISSING_SUBJECT);

        let mut failures = Vec::new();

        for id in ManagerId::for_current_platform() {
            if id.presence().await != Presence::Absent {
                continue;
            }

            let message = PackageManagerMissingMessage {
                package_manager: *id,
            };

            match self.nats_publisher.publish(&subject, message).await {
                Ok(()) => info!(manager = ?id, "Reported missing package manager"),
                Err(e) => failures.push(format!("{id:?}: {e:#}")),
            }
        }

        if failures.is_empty() {
            Ok(())
        } else {
            Err(anyhow!(
                "failed to report missing package managers: {}",
                failures.join("; ")
            ))
        }
    }
}

pub struct PackageManagerPresenceRunManager {
    reporter: PackageManagerPresenceReporter,
}

impl PackageManagerPresenceRunManager {
    pub fn new(reporter: PackageManagerPresenceReporter) -> Self {
        Self { reporter }
    }

    pub fn start(&self) {
        let reporter = self.reporter.clone();

        info!("Starting package manager presence run manager");

        tokio::spawn(async move {
            let report_timeout = report_timeout();
            let mut ticker = interval(PRESENCE_REPORT_INTERVAL.max(report_timeout + PUBLISH_GRACE));

            loop {
                ticker.tick().await;

                match timeout(report_timeout, reporter.report_presence()).await {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => error!("Failed to report missing package managers: {}", e),
                    Err(_) => error!("Package manager presence report timed out"),
                }
            }
        });
    }
}
