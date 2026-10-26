use crate::config::update_config::RECONNECTION_DELAY_MS;
use crate::models::CHAT_TOOL_AGENT_ID;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::tool_run_manager::ToolRunManager;
use crate::services::AgentConfigurationService;
use anyhow::{anyhow, Result};
use futures::StreamExt;
use tokio::time::Duration;
use tracing::{error, info, warn};

/// Starts the chat app on every remote-access message: an exited chat misses them, a fresh one resyncs through `sessions/current`.
#[derive(Clone)]
pub struct RemoteAccessMessageListener {
    nats_connection_manager: NatsConnectionManager,
    config_service: AgentConfigurationService,
    tool_run_manager: ToolRunManager,
}

impl RemoteAccessMessageListener {
    pub fn new(
        nats_connection_manager: NatsConnectionManager,
        config_service: AgentConfigurationService,
        tool_run_manager: ToolRunManager,
    ) -> Self {
        Self {
            nats_connection_manager,
            config_service,
            tool_run_manager,
        }
    }

    pub async fn start(&self) -> Result<tokio::task::JoinHandle<()>> {
        let listener = self.clone();
        let handle = tokio::spawn(async move {
            loop {
                info!("Starting remote access message listener...");
                if let Err(e) = listener.listen().await {
                    error!("Remote access message listener error: {:#}", e);
                }
                info!(
                    "Reconnecting remote access message listener in {} seconds...",
                    RECONNECTION_DELAY_MS / 1000
                );
                tokio::time::sleep(Duration::from_millis(RECONNECTION_DELAY_MS)).await;
            }
        });
        Ok(handle)
    }

    async fn listen(&self) -> Result<()> {
        let mut client_rx = self.nats_connection_manager.on_client_replaced();
        let client = self.nats_connection_manager.get_client().await?;
        let machine_id = self.config_service.get_machine_id()?;

        let subject = remote_access_subject(&machine_id);
        let mut subscriber = client
            .subscribe(subject.clone())
            .await
            .map_err(|e| anyhow!("failed to subscribe to {}: {}", subject, e))?;

        info!(subject = %subject, "Remote access message listener active");

        loop {
            tokio::select! {
                message = subscriber.next() => match message {
                    Some(message) => self.on_message(message.subject.as_str()),
                    None => {
                        warn!("Remote access message stream ended, resubscribing");
                        return Ok(());
                    }
                },
                _ = client_rx.changed() => {
                    info!("NATS client replaced, resubscribing remote access message listener");
                    return Ok(());
                }
            }
        }
    }

    // Spawned so a launch that waits for a console user never stalls the subscription.
    fn on_message(&self, subject: &str) {
        info!(
            subject,
            "Remote access message received, making sure the chat app is running"
        );
        let tool_run_manager = self.tool_run_manager.clone();
        tokio::spawn(async move {
            if let Err(e) = tool_run_manager
                .ensure_gui_app_running(CHAT_TOOL_AGENT_ID)
                .await
            {
                warn!(
                    "Failed to start the chat app for a remote access message: {:#}",
                    e
                );
            }
        });
    }
}

pub fn remote_access_subject(machine_id: &str) -> String {
    format!("machine.{}.remote-access.>", machine_id)
}

#[cfg(test)]
#[path = "remote_access_message_listener_tests.rs"]
mod tests;
