use crate::config::update_config::RECONNECTION_DELAY_MS;
use crate::models::{InstalledTool, ToolRecordState, CHAT_TOOL_AGENT_ID};
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::tool_run_manager::ToolRunManager;
use crate::services::{AgentConfigurationService, InstalledToolsService};
use anyhow::{anyhow, Context, Result};
use futures::StreamExt;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tokio::time::Duration;
use tracing::{debug, error, info, warn};

// The backend republishes a pending request every 2 s for up to 10 s; one launch attempt per window is enough.
const LAUNCH_WINDOW: Duration = Duration::from_secs(10);

/// Starts the chat app on every remote-access message: an exited chat misses them, a fresh one resyncs through `sessions/current`.
#[derive(Clone)]
pub struct RemoteAccessMessageListener {
    nats_connection_manager: NatsConnectionManager,
    config_service: AgentConfigurationService,
    installed_tools_service: InstalledToolsService,
    tool_run_manager: ToolRunManager,
    last_launch: Arc<Mutex<Option<Instant>>>,
}

impl RemoteAccessMessageListener {
    pub fn new(
        nats_connection_manager: NatsConnectionManager,
        config_service: AgentConfigurationService,
        installed_tools_service: InstalledToolsService,
        tool_run_manager: ToolRunManager,
    ) -> Self {
        Self {
            nats_connection_manager,
            config_service,
            installed_tools_service,
            tool_run_manager,
            last_launch: Arc::new(Mutex::new(None)),
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
        if !open_launch_window(&self.last_launch, Instant::now()) {
            debug!(
                subject,
                "Remote access message inside the launch window, chat launch already attempted"
            );
            return;
        }
        info!(
            subject,
            "Remote access message received, making sure the chat app is running"
        );
        let listener = self.clone();
        tokio::spawn(async move {
            if let Err(e) = listener.launch_chat().await {
                warn!(
                    "Failed to start the chat app for a remote access message: {:#}",
                    e
                );
            }
        });
    }

    async fn launch_chat(&self) -> Result<()> {
        if self.tool_run_manager.is_updating(CHAT_TOOL_AGENT_ID).await {
            info!("Chat app is being updated, the updater relaunches it");
            return Ok(());
        }
        let tool = self
            .installed_tools_service
            .get_by_tool_agent_id(CHAT_TOOL_AGENT_ID)
            .await
            .context("Failed to look up the chat app in the installed tools registry")?;
        match launchable_chat(tool) {
            Some(tool) => self.tool_run_manager.run_new_tool(tool).await,
            None => {
                info!("Chat app is not installed as a GuiApp, nothing to start");
                Ok(())
            }
        }
    }
}

pub fn remote_access_subject(machine_id: &str) -> String {
    format!("machine.{}.remote-access.>", machine_id)
}

// One attempt per window: a later message inside it finds the chat running or still starting.
fn open_launch_window(last_launch: &Mutex<Option<Instant>>, now: Instant) -> bool {
    let mut last = last_launch
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if last.is_some_and(|at| now.duration_since(at) < LAUNCH_WINDOW) {
        return false;
    }
    *last = Some(now);
    true
}

// Only a fully installed GuiApp record is launched; an install still in progress launches itself when it completes.
fn launchable_chat(tool: Option<InstalledTool>) -> Option<InstalledTool> {
    tool.filter(|t| t.installation.is_gui_app() && t.state == ToolRecordState::Installed)
}

#[cfg(test)]
#[path = "remote_access_message_listener_tests.rs"]
mod tests;
