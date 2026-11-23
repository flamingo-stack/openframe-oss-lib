use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use anyhow::{anyhow, Result};
use futures::StreamExt;
use tokio::time::Duration;
use tracing::{debug, error, info, warn};

use crate::config::update_config::RECONNECTION_DELAY_MS;
use crate::listener::command::RestartGate;
use crate::models::{identity_split_subject, IdentitySplitMessage};
use crate::services::agent_session;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::tool_restart_service::ToolRestartService;
use crate::services::{
    AgentConfigurationService, AgentRegistrationService, InstalledToolsService, MachineIdService,
};

#[derive(Clone)]
pub struct IdentitySplitListener {
    nats_connection_manager: NatsConnectionManager,
    config_service: AgentConfigurationService,
    registration_service: AgentRegistrationService,
    machine_id_service: MachineIdService,
    installed_tools_service: InstalledToolsService,
    tool_restart_service: ToolRestartService,
    restart_gate: RestartGate,
    splitting: Arc<AtomicBool>,
}

impl IdentitySplitListener {
    pub fn new(
        nats_connection_manager: NatsConnectionManager,
        config_service: AgentConfigurationService,
        registration_service: AgentRegistrationService,
        machine_id_service: MachineIdService,
        installed_tools_service: InstalledToolsService,
        tool_restart_service: ToolRestartService,
        restart_gate: RestartGate,
    ) -> Self {
        Self {
            nats_connection_manager,
            config_service,
            registration_service,
            machine_id_service,
            installed_tools_service,
            tool_restart_service,
            restart_gate,
            splitting: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn start(&self) -> Result<tokio::task::JoinHandle<()>> {
        let listener = self.clone();
        let handle = tokio::spawn(async move {
            loop {
                info!("Starting identity split listener...");
                if let Err(e) = listener.listen().await {
                    error!("Identity split listener error: {:#}", e);
                }
                info!(
                    "Reconnecting identity split listener in {} seconds...",
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

        let subject = identity_split_subject(&machine_id);
        let mut subscriber = client
            .subscribe(subject.clone())
            .await
            .map_err(|e| anyhow!("failed to subscribe to {}: {}", subject, e))?;

        info!(subject = %subject, session_id = agent_session::session_id(), "Identity split listener active");

        loop {
            tokio::select! {
                message = subscriber.next() => match message {
                    Some(message) => self.on_message(&message.payload),
                    None => {
                        warn!("Identity split message stream ended, resubscribing");
                        return Ok(());
                    }
                },
                _ = client_rx.changed() => {
                    info!("NATS client replaced, resubscribing identity split listener");
                    return Ok(());
                }
            }
        }
    }

    fn on_message(&self, payload: &[u8]) {
        let message: IdentitySplitMessage = match serde_json::from_slice(payload) {
            Ok(message) => message,
            Err(e) => {
                warn!(
                    "Ignoring an identity split message that does not parse: {:#}",
                    e
                );
                return;
            }
        };
        if !targets_this_session(&message, agent_session::session_id()) {
            debug!(
                session_id = %message.session_id,
                "Identity split is for another device sharing this machine"
            );
            return;
        }
        if self.splitting.swap(true, Ordering::AcqRel) {
            info!("Identity split already in progress");
            return;
        }
        let listener = self.clone();
        tokio::spawn(async move { listener.split(&message.session_id).await });
    }

    async fn split(&self, session_id: &str) {
        warn!(
            session_id,
            "Another device runs with this machine's identity, registering this device as a machine of its own"
        );
        match self.registration_service.split_identity(session_id).await {
            Ok(response) => {
                info!(machine_id = %response.machine_id, "Registered as a machine of its own")
            }
            Err(e) => {
                error!(
                    "Identity split failed, staying on the shared identity: {:#}",
                    e
                );
                self.splitting.store(false, Ordering::Release);
                return;
            }
        }
        if let Err(e) = self.machine_id_service.regenerate() {
            error!(
                "Failed to give this device a new local machine id, its tools keep the shared one: {:#}",
                e
            );
        }
        self.restart_tools().await;
        self.restart_gate.drain_and_request().await;
    }

    async fn restart_tools(&self) {
        let tools = match self.installed_tools_service.get_all().await {
            Ok(tools) => tools,
            Err(e) => {
                warn!(
                    "Cannot list installed tools to restart them under the new identity: {:#}",
                    e
                );
                return;
            }
        };
        for tool in tools {
            if let Err(e) = self
                .tool_restart_service
                .restart_guarded(&tool.tool_agent_id)
                .await
            {
                warn!(tool_agent_id = %tool.tool_agent_id, "Failed to restart tool under the new identity: {:#}", e);
            }
        }
    }
}

pub fn targets_this_session(message: &IdentitySplitMessage, session_id: &str) -> bool {
    message.session_id == session_id
}

#[cfg(test)]
#[path = "identity_split_listener_tests.rs"]
mod tests;
