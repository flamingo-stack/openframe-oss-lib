mod core_nats;
mod delivery;
mod handlers;
mod jetstream;

use std::future::Future;
use std::sync::Arc;

use anyhow::Result;
use async_nats::jetstream::consumer::DeliverPolicy;
use serde::de::DeserializeOwned;
use tokio::sync::Notify;
use tokio::time::Duration;
use tracing::{error, info};

use crate::config::update_config::RECONNECTION_DELAY_MS;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::ResultStore;
use crate::services::tool_run_manager::ToolRunManager;
use crate::services::AgentConfigurationService;

use delivery::Delivery;

pub use handlers::{
    ClientUninstallHandler, OpenFrameClientUpdateHandler, ToolAgentUpdateHandler,
    ToolInstallationHandler, ToolRestartHandler, ToolUninstallHandler,
};

pub trait CommandHandler: Clone + Send + Sync + 'static {
    type Command: DeserializeOwned + Send + 'static;
    type Guard: Send + 'static;

    const KIND: &'static str;
    const TRANSPORT: Transport;
    const PARK_DURING_CLIENT_UPDATE: bool;

    fn subject(machine_id: &str) -> String;

    fn label(command: &Self::Command) -> String;

    fn begin(&self, command: &Self::Command) -> impl Future<Output = Begin<Self::Guard>> + Send;

    fn run(
        &self,
        command: Self::Command,
        guard: Self::Guard,
    ) -> impl Future<Output = Outcome> + Send;
}

#[derive(Debug, Clone, Copy)]
pub enum Transport {
    JetStream(JetStreamConsumer),
    Core { retired: RetiredConsumer },
}

#[derive(Debug, Clone, Copy)]
pub struct JetStreamConsumer {
    pub stream: &'static str,
    pub durable: fn(&str) -> String,
    pub deliver_subject: fn(&str) -> String,
    pub deliver_policy: DeliverPolicy,
    pub max_deliver: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct RetiredConsumer {
    pub stream: &'static str,
    pub durable: fn(&str) -> String,
}

pub enum Begin<G> {
    Accepted(G),
    Busy,
}

#[derive(Debug, PartialEq)]
pub enum Outcome {
    Done,
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
    tool_run_manager: ToolRunManager,
    delivery: Delivery,
}

impl CommandContext {
    pub fn new(
        nats_connection_manager: NatsConnectionManager,
        config_service: AgentConfigurationService,
        tool_run_manager: ToolRunManager,
        publisher: NatsMessagePublisher,
        result_store: Arc<ResultStore>,
        flush_notify: Arc<Notify>,
    ) -> Self {
        Self {
            nats_connection_manager,
            config_service,
            tool_run_manager,
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
            let transport = H::TRANSPORT;
            if let Transport::Core { retired } = transport {
                let context = listener.context.clone();
                tokio::spawn(async move { core_nats::retire::<H>(&context, retired).await });
            }
            loop {
                info!(kind = H::KIND, "Starting command listener...");
                let result = match transport {
                    Transport::JetStream(consumer) => jetstream::listen(&listener, consumer).await,
                    Transport::Core { .. } => core_nats::listen(&listener).await,
                };
                match result {
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
