mod core_nats;
mod delivery;
mod handlers;
mod package_update;
mod restart;

use std::future::Future;
use std::sync::Arc;

use anyhow::Result;
use serde::de::DeserializeOwned;
use tokio::sync::Notify;
use tokio::time::Duration;
use tracing::{error, info};

use crate::config::update_config::RECONNECTION_DELAY_MS;
use crate::models::DeliveryRef;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::ResultStore;
use crate::services::AgentConfigurationService;

use delivery::Delivery;

pub use handlers::FeatureFlagsHandler;
pub use package_update::PackageUpdateHandler;
pub use restart::RestartGate;

pub trait CommandHandler: Clone + Send + Sync + 'static {
    type Command: DeserializeOwned + Send + 'static;

    const KIND: &'static str;

    fn subject(machine_id: &str) -> String;

    fn run(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        command: Self::Command,
    ) -> impl Future<Output = Outcome> + Send;

    fn awaiting_restart(&self) -> Option<DeliveryRef> {
        None
    }

    fn restart_reported(&self) -> Result<()> {
        Ok(())
    }
}

#[derive(Debug, PartialEq)]
pub enum Outcome {
    Done,
    RestartRequired,
    Failed(String),
}

#[derive(Clone)]
pub struct CommandContext {
    nats_connection_manager: NatsConnectionManager,
    config_service: AgentConfigurationService,
    restart: RestartGate,
    delivery: Delivery,
}

impl CommandContext {
    pub fn new(
        nats_connection_manager: NatsConnectionManager,
        config_service: AgentConfigurationService,
        restart: RestartGate,
        publisher: NatsMessagePublisher,
        result_store: Arc<ResultStore>,
        flush_notify: Arc<Notify>,
    ) -> Self {
        Self {
            nats_connection_manager,
            config_service,
            restart,
            delivery: Delivery::new(publisher, result_store, flush_notify),
        }
    }
}

#[derive(Clone)]
pub struct CommandListener<H> {
    handler: H,
    context: CommandContext,
}

impl<H: CommandHandler> CommandListener<H> {
    pub fn new(handler: H, context: CommandContext) -> Self {
        Self { handler, context }
    }

    pub async fn start(&self) -> Result<tokio::task::JoinHandle<()>> {
        let listener = self.clone();
        let handle = tokio::spawn(async move {
            core_nats::report_restart_completion(&listener).await;
            loop {
                info!(kind = H::KIND, "Starting command listener...");
                match core_nats::listen(&listener).await {
                    Ok(()) => info!(kind = H::KIND, "Command listener rebinding"),
                    Err(e) => error!(kind = H::KIND, "Command listener error: {:#}", e),
                }
                info!(
                    kind = H::KIND,
                    "Reconnecting command listener in {} seconds...",
                    RECONNECTION_DELAY_MS / 1000
                );
                tokio::time::sleep(Duration::from_millis(RECONNECTION_DELAY_MS)).await;
            }
        });
        Ok(handle)
    }
}

#[cfg(test)]
#[path = "integration_tests.rs"]
mod integration_tests;
