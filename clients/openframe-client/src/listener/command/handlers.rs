use std::sync::Arc;

use async_nats::jetstream::consumer::DeliverPolicy;
use serde::de::IgnoredAny;

use super::{Begin, CommandHandler, JetStreamConsumer, Outcome, RetiredConsumer, Transport};
use crate::config::update_config::{
    CONSUMER_MAX_DELIVER, RESTART_CONSUMER_MAX_DELIVER, UNINSTALL_CONSUMER_MAX_DELIVER,
};
use crate::models::{
    OpenFrameClientUpdateMessage, ToolAgentUpdateMessage, ToolInstallationMessage,
    ToolRestartMessage, ToolUninstallMessage,
};
use crate::services::deactivation_service::DeactivationService;
use crate::services::openframe_client_update_service::OpenFrameClientUpdateService;
use crate::services::tool_agent_update_service::ToolAgentUpdateService;
use crate::services::tool_installation_service::ToolInstallationService;
use crate::services::tool_ops::{ToolLock, ToolOps};
use crate::services::tool_restart_service::{RestartOutcome, ToolRestartService};
use crate::services::tool_run_manager::ToolRunManager;
use crate::services::tool_uninstall_service::{ToolUninstallService, UninstallOutcome};

const TOOL_BUSY: &str = "tool busy with another operation";

#[derive(Clone)]
pub struct ToolInstallationHandler {
    service: ToolInstallationService,
    tool_ops: ToolOps,
}

impl ToolInstallationHandler {
    pub fn new(service: ToolInstallationService, tool_ops: ToolOps) -> Self {
        Self { service, tool_ops }
    }
}

impl CommandHandler for ToolInstallationHandler {
    type Command = ToolInstallationMessage;
    type Guard = ToolLock;

    const KIND: &'static str = "tool-installation";
    const TRANSPORT: Transport = Transport::Core {
        retired: RetiredConsumer {
            stream: "TOOL_INSTALLATION",
            durable: tool_installation_durable,
        },
    };
    const PARK_DURING_CLIENT_UPDATE: bool = true;

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.tool-installation", machine_id)
    }

    fn label(command: &Self::Command) -> String {
        command.tool_agent_id.clone()
    }

    async fn begin(&self, command: &Self::Command) -> Begin<ToolLock> {
        match self.tool_ops.try_lock(&command.tool_agent_id) {
            Ok(lock) => Begin::Accepted(lock),
            Err(_) => Begin::Busy,
        }
    }

    async fn run(&self, command: Self::Command, lock: ToolLock) -> Outcome {
        self.service.install(command, lock).await.into()
    }
}

fn tool_installation_durable(machine_id: &str) -> String {
    format!("machine_{}_tool-installation_consumer", machine_id)
}

#[derive(Clone)]
pub struct ClientUninstallHandler {
    deactivation_service: Arc<DeactivationService>,
}

impl ClientUninstallHandler {
    pub fn new(deactivation_service: Arc<DeactivationService>) -> Self {
        Self {
            deactivation_service,
        }
    }
}

impl CommandHandler for ClientUninstallHandler {
    type Command = IgnoredAny;
    type Guard = ();

    const KIND: &'static str = "client-uninstall";
    const TRANSPORT: Transport = Transport::Core {
        retired: RetiredConsumer {
            stream: "CLIENT_UNINSTALL",
            durable: client_uninstall_durable,
        },
    };
    const PARK_DURING_CLIENT_UPDATE: bool = false;

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.client-uninstall", machine_id)
    }

    fn label(_command: &Self::Command) -> String {
        "client".to_string()
    }

    async fn begin(&self, _command: &Self::Command) -> Begin<()> {
        Begin::Accepted(())
    }

    async fn run(&self, _command: Self::Command, _guard: ()) -> Outcome {
        if !cfg!(any(target_os = "macos", target_os = "windows")) {
            return Outcome::Failed(
                "client self-uninstall is not supported on this platform".to_string(),
            );
        }
        self.deactivation_service.request_uninstall().await;
        Outcome::Done
    }
}

fn client_uninstall_durable(machine_id: &str) -> String {
    format!("machine_{}_client-uninstall_consumer", machine_id)
}

#[derive(Clone)]
pub struct ToolUninstallHandler {
    service: ToolUninstallService,
    tool_ops: ToolOps,
    tool_run_manager: ToolRunManager,
}

impl ToolUninstallHandler {
    pub fn new(
        service: ToolUninstallService,
        tool_ops: ToolOps,
        tool_run_manager: ToolRunManager,
    ) -> Self {
        Self {
            service,
            tool_ops,
            tool_run_manager,
        }
    }
}

impl CommandHandler for ToolUninstallHandler {
    type Command = ToolUninstallMessage;
    type Guard = ();

    const KIND: &'static str = "tool-uninstall";
    const TRANSPORT: Transport = Transport::JetStream(JetStreamConsumer {
        stream: "TOOL_INSTALLATION",
        durable: tool_uninstall_durable,
        deliver_subject: tool_uninstall_deliver_subject,
        deliver_policy: DeliverPolicy::All,
        max_deliver: UNINSTALL_CONSUMER_MAX_DELIVER,
    });
    const PARK_DURING_CLIENT_UPDATE: bool = true;

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.tool-uninstall", machine_id)
    }

    fn label(command: &Self::Command) -> String {
        command.tool_agent_id.clone()
    }

    async fn begin(&self, _command: &Self::Command) -> Begin<()> {
        Begin::Accepted(())
    }

    async fn run(&self, command: Self::Command, _guard: ()) -> Outcome {
        match self
            .service
            .uninstall_guarded(
                &command.tool_agent_id,
                &self.tool_ops,
                &self.tool_run_manager,
            )
            .await
        {
            Ok(UninstallOutcome::Removed | UninstallOutcome::NotInstalled) => Outcome::Done,
            Ok(UninstallOutcome::Busy) => Outcome::Failed(TOOL_BUSY.to_string()),
            Err(e) => Outcome::Failed(format!("{e:#}")),
        }
    }
}

fn tool_uninstall_durable(machine_id: &str) -> String {
    format!("machine_{}_tool-uninstall_consumer", machine_id)
}

fn tool_uninstall_deliver_subject(machine_id: &str) -> String {
    format!("machine.{}.tool-uninstall.inbox", machine_id)
}

#[derive(Clone)]
pub struct ToolRestartHandler {
    service: ToolRestartService,
}

impl ToolRestartHandler {
    pub fn new(service: ToolRestartService) -> Self {
        Self { service }
    }
}

impl CommandHandler for ToolRestartHandler {
    type Command = ToolRestartMessage;
    type Guard = ();

    const KIND: &'static str = "tool-restart";
    const TRANSPORT: Transport = Transport::JetStream(JetStreamConsumer {
        stream: "TOOL_INSTALLATION",
        durable: tool_restart_durable,
        deliver_subject: tool_restart_deliver_subject,
        deliver_policy: DeliverPolicy::All,
        max_deliver: RESTART_CONSUMER_MAX_DELIVER,
    });
    const PARK_DURING_CLIENT_UPDATE: bool = true;

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.tool-restart", machine_id)
    }

    fn label(command: &Self::Command) -> String {
        command.tool_agent_id.clone()
    }

    async fn begin(&self, _command: &Self::Command) -> Begin<()> {
        Begin::Accepted(())
    }

    async fn run(&self, command: Self::Command, _guard: ()) -> Outcome {
        match self.service.restart_guarded(&command.tool_agent_id).await {
            Ok(RestartOutcome::Restarted | RestartOutcome::NotInstalled) => Outcome::Done,
            Ok(RestartOutcome::Busy) => Outcome::Failed(TOOL_BUSY.to_string()),
            Err(e) => Outcome::Failed(format!("{e:#}")),
        }
    }
}

fn tool_restart_durable(machine_id: &str) -> String {
    format!("machine_{}_tool-restart_consumer", machine_id)
}

fn tool_restart_deliver_subject(machine_id: &str) -> String {
    format!("machine.{}.tool-restart.inbox", machine_id)
}

#[derive(Clone)]
pub struct ToolAgentUpdateHandler {
    service: ToolAgentUpdateService,
}

impl ToolAgentUpdateHandler {
    pub fn new(service: ToolAgentUpdateService) -> Self {
        Self { service }
    }
}

impl CommandHandler for ToolAgentUpdateHandler {
    type Command = ToolAgentUpdateMessage;
    type Guard = ();

    const KIND: &'static str = "tool-update";
    const TRANSPORT: Transport = Transport::JetStream(JetStreamConsumer {
        stream: "TOOL_UPDATE",
        durable: tool_update_durable,
        deliver_subject: tool_update_deliver_subject,
        deliver_policy: DeliverPolicy::New,
        max_deliver: CONSUMER_MAX_DELIVER,
    });
    const PARK_DURING_CLIENT_UPDATE: bool = true;

    fn subject(_machine_id: &str) -> String {
        "machine.all.tool.*.update".to_string()
    }

    fn label(command: &Self::Command) -> String {
        command.tool_agent_id.clone()
    }

    async fn begin(&self, _command: &Self::Command) -> Begin<()> {
        Begin::Accepted(())
    }

    async fn run(&self, command: Self::Command, _guard: ()) -> Outcome {
        self.service.process_update(command).await.into()
    }
}

fn tool_update_durable(machine_id: &str) -> String {
    format!("machine_{}_tool_update_consumer", machine_id)
}

fn tool_update_deliver_subject(machine_id: &str) -> String {
    format!("machine.{}.tool.update.inbox", machine_id)
}

#[derive(Clone)]
pub struct OpenFrameClientUpdateHandler {
    service: OpenFrameClientUpdateService,
}

impl OpenFrameClientUpdateHandler {
    pub fn new(service: OpenFrameClientUpdateService) -> Self {
        Self { service }
    }
}

impl CommandHandler for OpenFrameClientUpdateHandler {
    type Command = OpenFrameClientUpdateMessage;
    type Guard = ();

    const KIND: &'static str = "client-update";
    const TRANSPORT: Transport = Transport::JetStream(JetStreamConsumer {
        stream: "CLIENT_UPDATE",
        durable: client_update_durable,
        deliver_subject: client_update_deliver_subject,
        deliver_policy: DeliverPolicy::New,
        max_deliver: CONSUMER_MAX_DELIVER,
    });
    const PARK_DURING_CLIENT_UPDATE: bool = false;

    fn subject(_machine_id: &str) -> String {
        "machine.all.client-update".to_string()
    }

    fn label(command: &Self::Command) -> String {
        command.version.clone()
    }

    async fn begin(&self, _command: &Self::Command) -> Begin<()> {
        Begin::Accepted(())
    }

    async fn run(&self, command: Self::Command, _guard: ()) -> Outcome {
        self.service.process_update(command).await.into()
    }
}

fn client_update_durable(machine_id: &str) -> String {
    format!("machine_{}_client-update_consumer_v2", machine_id)
}

fn client_update_deliver_subject(machine_id: &str) -> String {
    format!("machine.{}.client-update.inbox", machine_id)
}

#[cfg(test)]
#[path = "handlers_tests.rs"]
mod tests;
