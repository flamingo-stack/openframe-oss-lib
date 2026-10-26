mod core_nats;
mod delivery;
mod handlers;
mod restart;

use std::future::Future;
use std::sync::Arc;

use anyhow::Result;
use serde::de::DeserializeOwned;
use tokio::sync::{Notify, OnceCell};
use tokio::time::Duration;
use tracing::{error, info};

use crate::config::update_config::RECONNECTION_DELAY_MS;
use crate::models::DeliveryRef;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::ResultStore;
use crate::services::AgentConfigurationService;

use delivery::Delivery;

pub use handlers::{
    ClientUninstallHandler, FeatureFlagsHandler, ToolInstallationHandler, ToolUpdateHandler,
};
pub use restart::RestartGate;

pub trait CommandHandler: Clone + Send + Sync + 'static {
    type Command: DeserializeOwned + Send + 'static;
    type Guard: Send + 'static;

    const KIND: &'static str;
    // state-like: a sequence at or below the last applied one is answered done without running
    const SEQUENCED: bool = false;
    // the run can stop this process before it returns, so the next start settles it instead of failing it
    const RESTARTS_AGENT: bool = false;
    // the agent removes itself after the run, so the result is published before the outbox goes with it
    const REMOVES_AGENT: bool = false;

    fn subject(machine_id: &str) -> String;

    fn begin(&self, command: &Self::Command) -> Begin<Self::Guard>;

    fn run(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        command: Self::Command,
        guard: Self::Guard,
    ) -> impl Future<Output = Outcome> + Send;

    // the floor for SEQUENCED types kept outside the shared store, e.g. by a service that predates it
    fn applied_sequence(&self, _machine_id: &str) -> i64 {
        0
    }

    // REMOVES_AGENT: starts the removal once the done result is out
    fn remove_agent(&self) -> impl Future<Output = ()> + Send {
        async {}
    }

    fn awaiting_restart(&self) -> Option<DeliveryRef> {
        None
    }

    fn restart_reported(&self) -> Result<()> {
        Ok(())
    }
}

pub enum Begin<G> {
    Accepted(G),
    Busy(String),
}

#[derive(Debug, PartialEq)]
pub enum Outcome {
    Done,
    RestartRequired,
    // the command restarts the agent itself and the next start reports how it ended
    Restarting,
    Failed(String),
}

impl From<Result<()>> for Outcome {
    fn from(result: Result<()>) -> Self {
        match result {
            Ok(()) => Outcome::Done,
            Err(e) => Outcome::Failed(format!("{e:#}")),
        }
    }
}

#[derive(Clone)]
pub struct CommandContext {
    nats_connection_manager: NatsConnectionManager,
    config_service: AgentConfigurationService,
    restart: RestartGate,
    delivery: Delivery,
    recovered: Arc<OnceCell<()>>,
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
            recovered: Arc::new(OnceCell::new()),
        }
    }

    // commands cut short by the last stop are failed once, before any listener of this context subscribes
    async fn recover_once(&self) {
        self.recovered.get_or_init(|| self.delivery.recover()).await;
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
            listener.context.recover_once().await;
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
