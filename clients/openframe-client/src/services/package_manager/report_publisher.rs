use super::state::{state_of, ManagerState};
use super::{Dependency, ManagerId, Presence};
use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use anyhow::Result;
use serde::Serialize;
use std::collections::BTreeMap;
use tracing::info;

const PACKAGE_MANAGERS_SUBJECT: &str = "package-managers";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PackageManagerReport {
    package_managers: BTreeMap<ManagerId, ManagerState>,
    dependencies: Vec<DependencyReport>,
}

#[derive(Debug, Serialize)]
struct DependencyReport {
    manager: ManagerId,
    name: Dependency,
    state: ManagerState,
}

#[derive(Clone)]
pub struct PackageManagerReportPublisher {
    nats_publisher: NatsMessagePublisher,
    config_service: AgentConfigurationService,
}

impl PackageManagerReportPublisher {
    pub fn new(
        nats_publisher: NatsMessagePublisher,
        config_service: AgentConfigurationService,
    ) -> Self {
        Self {
            nats_publisher,
            config_service,
        }
    }

    pub async fn publish(&self) -> Result<()> {
        let machine_id = self.config_service.get_machine_id()?;
        let subject = format!("machine.{}.{}", machine_id, PACKAGE_MANAGERS_SUBJECT);

        let console_user_present = crate::executor::console_user_present().await;
        let mut package_managers = BTreeMap::new();

        for id in ManagerId::ALL {
            package_managers.insert(*id, state_of(*id, console_user_present).await);
        }

        let dependencies: Vec<DependencyReport> = Dependency::ALL
            .iter()
            .filter(|dependency| {
                package_managers.get(&dependency.manager()) == Some(&ManagerState::Present)
            })
            .map(|dependency| DependencyReport {
                manager: dependency.manager(),
                name: *dependency,
                state: match dependency.presence() {
                    Presence::Present => ManagerState::Present,
                    Presence::Absent => ManagerState::Missing,
                    Presence::Unknown => ManagerState::Unknown,
                },
            })
            .collect();

        info!(
            report = ?package_managers,
            ?dependencies,
            console_user_present,
            "Reporting package manager state"
        );
        self.nats_publisher
            .publish(
                &subject,
                PackageManagerReport {
                    package_managers,
                    dependencies,
                },
            )
            .await
    }
}

#[cfg(test)]
#[path = "report_publisher_tests.rs"]
mod tests;
