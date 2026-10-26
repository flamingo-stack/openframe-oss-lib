use std::sync::Arc;

use tokio::task::JoinHandle;
use tokio::time::Duration;
use tracing::{error, info, warn};

use crate::clients::{DeviceModeOutcome, RemoteAccessClient};
use crate::models::RemoteAccessMode;
use crate::services::backend_call_retry::{retry_until_settled, RetryTiming};
use crate::services::deactivation_service::DeactivationService;
use crate::services::InitialConfigurationService;

const RETRY_INITIAL: Duration = Duration::from_secs(30);
const RETRY_MAX: Duration = Duration::from_secs(30 * 60);

/// Forwards the install-time `--remote-access-mode` to the backend as the device override.
pub struct RemoteAccessModeService {
    client: RemoteAccessClient,
    initial_config_service: InitialConfigurationService,
    deactivation: Arc<DeactivationService>,
    timing: RetryTiming,
}

impl RemoteAccessModeService {
    pub fn new(
        client: RemoteAccessClient,
        initial_config_service: InitialConfigurationService,
        deactivation: Arc<DeactivationService>,
    ) -> Self {
        Self {
            client,
            initial_config_service,
            deactivation,
            timing: RetryTiming {
                initial: RETRY_INITIAL,
                max: RETRY_MAX,
            },
        }
    }

    /// Sends a pending mode in the background until the backend settles it; no-op without one.
    pub fn start(self: Arc<Self>) -> Option<JoinHandle<()>> {
        let name = match self.initial_config_service.get_remote_access_mode() {
            Ok(Some(name)) => name,
            Ok(None) => return None,
            Err(e) => {
                error!("Failed to read the pending remote access mode: {:#}", e);
                return None;
            }
        };
        let Some(mode) = RemoteAccessMode::from_wire_name(&name) else {
            warn!("Dropping unknown install-time remote access mode {}", name);
            self.clear();
            return None;
        };

        info!(
            "Setting install-time remote access mode {} on this device",
            name
        );
        Some(tokio::spawn(async move { self.apply(mode).await }))
    }

    async fn apply(&self, mode: RemoteAccessMode) {
        let name = mode.wire_name();
        let outcome = retry_until_settled(
            &self.deactivation,
            self.timing,
            &format!("set remote access mode {}", name),
            || self.client.set_device_mode(mode),
        )
        .await;
        match outcome {
            DeviceModeOutcome::Applied => info!("Remote access mode {} set on this device", name),
            DeviceModeOutcome::NotSupported => warn!(
                "Backend does not support setting the remote access mode; dropping {}",
                name
            ),
            DeviceModeOutcome::OverrideExists => warn!(
                "Device already has a different remote access mode; keeping it and dropping {}",
                name
            ),
        }
        self.clear();
    }

    fn clear(&self) {
        if let Err(e) = self.initial_config_service.clear_remote_access_mode() {
            error!("Failed to clear the pending remote access mode: {:#}", e);
        }
    }
}

#[cfg(test)]
#[path = "remote_access_mode_service_tests.rs"]
mod tests;
