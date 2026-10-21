use std::sync::Arc;

use anyhow::Result;
use serde::de::IgnoredAny;

use super::{Begin, CommandHandler, Outcome};
use crate::models::{
    DeliveryRef, FeatureFlagsMessage, OpenFrameClientUpdateMessage, ToolAgentUpdateMessage,
    ToolInstallationMessage,
};
use crate::services::deactivation_service::DeactivationService;
use crate::services::feature_flags_service::{FeatureFlagsService, FlagsApplied};
use crate::services::openframe_client_update_service::{
    OpenFrameClientUpdateService, UpdateLaunch,
};
use crate::services::tool_agent_update_service::ToolAgentUpdateService;
use crate::services::tool_installation_service::ToolInstallationService;
use crate::services::tool_ops::{ToolLock, ToolOps};
use crate::services::tool_run_manager::{ClientUpdatePending, ToolRunManager};

const TOOL_BUSY: &str = "tool busy with another operation";
const CLIENT_UPDATE_PENDING: &str = "client update pending";

#[derive(Clone)]
pub struct FeatureFlagsHandler {
    service: Arc<FeatureFlagsService>,
}

impl FeatureFlagsHandler {
    pub fn new(service: Arc<FeatureFlagsService>) -> Self {
        Self { service }
    }
}

impl CommandHandler for FeatureFlagsHandler {
    type Command = FeatureFlagsMessage;
    type Guard = ();

    const KIND: &'static str = "feature-flags";
    const SEQUENCED: bool = true;

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.feature-flags", machine_id)
    }

    fn begin(&self, _command: &Self::Command) -> Begin<()> {
        Begin::Accepted(())
    }

    async fn run(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        command: Self::Command,
        _guard: (),
    ) -> Outcome {
        let Some(sequence) = delivery.sequence else {
            return Outcome::Failed("feature flags without a sequence".to_string());
        };
        match self.service.apply(machine_id, delivery, sequence, command) {
            Ok(FlagsApplied::Unchanged) => Outcome::Done,
            Ok(FlagsApplied::RestartRequired) => Outcome::RestartRequired,
            Err(e) => Outcome::Failed(format!("{e:#}")),
        }
    }

    fn awaiting_restart(&self) -> Option<DeliveryRef> {
        self.service.awaiting_restart()
    }

    fn restart_reported(&self) -> Result<()> {
        self.service.restart_reported()
    }
}

#[derive(Clone)]
pub struct ToolInstallationHandler {
    service: ToolInstallationService,
    tool_ops: ToolOps,
    client_update: ClientUpdatePending,
}

impl ToolInstallationHandler {
    pub fn new(
        service: ToolInstallationService,
        tool_ops: ToolOps,
        client_update: ClientUpdatePending,
    ) -> Self {
        Self {
            service,
            tool_ops,
            client_update,
        }
    }
}

impl CommandHandler for ToolInstallationHandler {
    type Command = ToolInstallationMessage;
    type Guard = ToolLock;

    const KIND: &'static str = "tool-installation";

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.tool-installation.v2", machine_id)
    }

    fn begin(&self, command: &Self::Command) -> Begin<ToolLock> {
        lock_tool(&self.tool_ops, &self.client_update, &command.tool_agent_id)
    }

    async fn run(
        &self,
        _machine_id: &str,
        _delivery: &DeliveryRef,
        command: Self::Command,
        lock: ToolLock,
    ) -> Outcome {
        self.service.install_locked(command, lock).await.into()
    }
}

#[derive(Clone)]
pub struct ToolUpdateHandler {
    service: ToolAgentUpdateService,
    tool_ops: ToolOps,
    client_update: ClientUpdatePending,
}

impl ToolUpdateHandler {
    pub fn new(
        service: ToolAgentUpdateService,
        tool_ops: ToolOps,
        client_update: ClientUpdatePending,
    ) -> Self {
        Self {
            service,
            tool_ops,
            client_update,
        }
    }
}

impl CommandHandler for ToolUpdateHandler {
    type Command = ToolAgentUpdateMessage;
    type Guard = ToolLock;

    const KIND: &'static str = "tool-update";
    const SEQUENCED: bool = true;

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.tool-update.v2", machine_id)
    }

    fn begin(&self, command: &Self::Command) -> Begin<ToolLock> {
        lock_tool(&self.tool_ops, &self.client_update, &command.tool_agent_id)
    }

    async fn run(
        &self,
        _machine_id: &str,
        _delivery: &DeliveryRef,
        command: Self::Command,
        lock: ToolLock,
    ) -> Outcome {
        self.service
            .process_update_locked(command, lock)
            .await
            .into()
    }
}

#[derive(Clone)]
pub struct ClientUpdateHandler {
    service: OpenFrameClientUpdateService,
    tool_ops: ToolOps,
    tool_run_manager: ToolRunManager,
}

impl ClientUpdateHandler {
    pub fn new(
        service: OpenFrameClientUpdateService,
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

impl CommandHandler for ClientUpdateHandler {
    type Command = OpenFrameClientUpdateMessage;
    type Guard = ();

    const KIND: &'static str = "client-update";
    const SEQUENCED: bool = true;
    const RESTARTS_AGENT: bool = true;

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.client-update.v2", machine_id)
    }

    // marked before the busy check, as the legacy path does, so new tool operations wait behind the update
    fn begin(&self, _command: &Self::Command) -> Begin<()> {
        self.tool_run_manager.mark_client_update_pending();
        if self.tool_ops.any_busy() {
            return Begin::Busy(TOOL_BUSY);
        }
        Begin::Accepted(())
    }

    async fn run(
        &self,
        _machine_id: &str,
        _delivery: &DeliveryRef,
        command: Self::Command,
        _guard: (),
    ) -> Outcome {
        match self.service.process_update(command).await {
            Ok(UpdateLaunch::Launched) => Outcome::Restarting,
            Ok(UpdateLaunch::Skipped) => Outcome::Done,
            Err(e) => Outcome::Failed(format!("{e:#}")),
        }
    }
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
    const REMOVES_AGENT: bool = true;

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.client-uninstall.v2", machine_id)
    }

    fn begin(&self, _command: &Self::Command) -> Begin<()> {
        Begin::Accepted(())
    }

    async fn run(
        &self,
        _machine_id: &str,
        _delivery: &DeliveryRef,
        _command: Self::Command,
        _guard: (),
    ) -> Outcome {
        if !cfg!(any(target_os = "macos", target_os = "windows")) {
            return Outcome::Failed(
                "client self-uninstall is not supported on this platform".to_string(),
            );
        }
        self.deactivation_service.request_uninstall().await;
        Outcome::Done
    }
}

fn lock_tool(
    tool_ops: &ToolOps,
    client_update: &ClientUpdatePending,
    tool_agent_id: &str,
) -> Begin<ToolLock> {
    if client_update.is_pending() {
        return Begin::Busy(CLIENT_UPDATE_PENDING);
    }
    match tool_ops.try_lock(tool_agent_id) {
        Ok(lock) => Begin::Accepted(lock),
        Err(_) => Begin::Busy(TOOL_BUSY),
    }
}

#[cfg(test)]
#[path = "handlers_tests.rs"]
mod tests;
