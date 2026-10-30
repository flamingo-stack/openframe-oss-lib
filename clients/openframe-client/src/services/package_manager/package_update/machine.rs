use std::path::Path;

use async_trait::async_trait;

use super::close;
use super::managers::{self, Probe, QueryError, UpgradeOutcome};
use crate::models::PackageRef;
use crate::platform::process_snapshot::RunningProcess;
use crate::platform::{app_close, user_session};
use crate::services::package_manager::update_gate::{self, AppIdentity, Undetermined};
use crate::services::package_manager::{ManagerId, Presence};

/// Everything the worker asks of the device and its package managers.
#[async_trait]
pub(super) trait Machine: Send + Sync {
    async fn console_user_present(&self) -> bool;
    async fn presence(&self, manager: ManagerId) -> Presence;
    async fn probe(&self, package: &PackageRef) -> Result<Probe, QueryError>;
    async fn resolve(&self, package: &PackageRef) -> Result<AppIdentity, Undetermined>;
    async fn snapshot(&self) -> Result<Vec<RunningProcess>, Undetermined>;
    /// Returns the pids still running after the close.
    async fn close(&self, pids: &[u32]) -> Vec<u32>;
    async fn upgrade(&self, package: &PackageRef) -> UpgradeOutcome;
    /// The manager's view after an upgrade, without refreshing its catalog first.
    async fn reread(&self, package: &PackageRef) -> Result<Probe, QueryError>;
    async fn reopen(&self, image: &Path, session: Option<u32>, user: Option<&str>) -> bool;
    fn session_user(&self, session: Option<u32>) -> Option<String>;
}

/// The device the agent runs on.
pub(super) struct System;

#[async_trait]
impl Machine for System {
    async fn console_user_present(&self) -> bool {
        crate::executor::console_user_present().await
    }

    async fn presence(&self, manager: ManagerId) -> Presence {
        manager.presence().await
    }

    async fn probe(&self, package: &PackageRef) -> Result<Probe, QueryError> {
        managers::probe(package).await
    }

    async fn resolve(&self, package: &PackageRef) -> Result<AppIdentity, Undetermined> {
        update_gate::resolve(package).await
    }

    async fn snapshot(&self) -> Result<Vec<RunningProcess>, Undetermined> {
        update_gate::snapshot().await
    }

    async fn close(&self, pids: &[u32]) -> Vec<u32> {
        close::close(pids).await
    }

    async fn upgrade(&self, package: &PackageRef) -> UpgradeOutcome {
        managers::upgrade(package).await
    }

    async fn reread(&self, package: &PackageRef) -> Result<Probe, QueryError> {
        managers::reread(package).await
    }

    async fn reopen(&self, image: &Path, session: Option<u32>, user: Option<&str>) -> bool {
        app_close::reopen(image, session, user).await
    }

    fn session_user(&self, session: Option<u32>) -> Option<String> {
        user_session::session_user(session)
    }
}
