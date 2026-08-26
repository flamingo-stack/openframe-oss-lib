use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::deactivation_service::DeactivationService;
use crate::services::local_tls_config_provider::LocalTlsConfigProvider;
use crate::services::{AgentAuthService, InitialConfigurationService};
use anyhow::{Context, Result};
use async_nats::{Client, Event};
use log::error;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use tokio::sync::Notify;
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Reconnect delay while the tenant is gone (suspended): backs the 5s storm off ~60x so a
/// deleted-tenant client barely touches the gateway. Auto-reverts to 5s on recovery.
const SUSPENDED_RECONNECT_DELAY: std::time::Duration = std::time::Duration::from_secs(5 * 60);

/// How often to check whether TokenRefreshRunManager has issued a new access token. Cheap — the
/// token is read from the local config file. Its refresh lands at least 15s before expiry and
/// normally 5 minutes before, so this notices the rotation with room to spare.
const TOKEN_POLL_INTERVAL: Duration = Duration::from_secs(15);

#[derive(Clone)]
pub struct NatsConnectionManager {
    client: Arc<RwLock<Option<Arc<Client>>>>,
    reconnect_tx: broadcast::Sender<()>,
    nats_server_url: String,
    config_service: AgentConfigurationService,
    tls_config_provider: LocalTlsConfigProvider,
    initial_configuration_service: InitialConfigurationService,
    auth_service: AgentAuthService,
    deactivation: Arc<DeactivationService>,
    /// Wakes the rotation supervisor early when a handshake is rejected.
    rotate_now: Arc<Notify>,
    /// Keeps a second connect() from spawning a second supervisor.
    supervisor_started: Arc<AtomicBool>,
}

impl NatsConnectionManager {
    const NATS_DEVICE_USER: &'static str = "machine";
    const NATS_DEVICE_PASSWORD: &'static str = "";

    pub fn new(
        nats_server_url: String,
        config_service: AgentConfigurationService,
        initial_configuration_service: InitialConfigurationService,
        auth_service: AgentAuthService,
        tls_config_provider: LocalTlsConfigProvider,
        deactivation: Arc<DeactivationService>,
    ) -> Self {
        let (reconnect_tx, _) = broadcast::channel(16);
        Self {
            client: Arc::new(RwLock::new(None)),
            reconnect_tx,
            nats_server_url: nats_server_url.to_string(),
            config_service,
            tls_config_provider,
            initial_configuration_service,
            auth_service,
            deactivation,
            rotate_now: Arc::new(Notify::new()),
            supervisor_started: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn subscribe_reconnect(&self) -> broadcast::Receiver<()> {
        self.reconnect_tx.subscribe()
    }

    pub async fn connect(&self) -> Result<()> {
        let client = self.build_client().await?;
        *self.client.write().await = Some(Arc::new(client));
        self.start_rotation_supervisor();
        Ok(())
    }

    /// Builds a client whose bearer token travels in the `Authorization` handshake header.
    ///
    /// The token is deliberately absent from the URL. A credential in a query string is copied
    /// verbatim into every access log that records the request line — in front of this agent that
    /// is the Google load balancer, which retains it for 30 days. A handshake header reaches none
    /// of those sinks. Headers are frozen when ConnectOptions is built, so a rotated token is
    /// adopted by building a new client; see `start_rotation_supervisor`.
    async fn build_client(&self) -> Result<Client> {
        let machine_id = self.config_service.get_machine_id()?;
        let token = self.config_service.get_access_token().await?;

        info!(
            hostname = %self.nats_server_url,
            "Connecting to NATS server"
        );

        let connection_url = self.build_nats_connection_url();

        // Cloned dependencies for auth callback
        let auth_service = self.auth_service.clone();
        let deactivation = self.deactivation.clone();
        let rotate_now = self.rotate_now.clone();
        let deactivation_for_delay = self.deactivation.clone();
        let nats_server_url = self.nats_server_url.clone();
        let nats_server_url_for_reconnect = self.nats_server_url.clone();
        let reconnect_tx = self.reconnect_tx.clone();
        let connected_once = Arc::new(AtomicBool::new(false));

        // TODO: token fallback and connection retry
        let mut connect_options = async_nats::ConnectOptions::new()
            .name(machine_id.clone())
            .user_and_password(
                Self::NATS_DEVICE_USER.to_string(),
                Self::NATS_DEVICE_PASSWORD.to_string(),
            )
            .retry_on_initial_connect()
            .max_reconnects(None)
            .reconnect_delay_callback(move |attempt| {
                // Tenant gone: async-nats can't be stopped from here (its reconnect loop never
                // polls Drain), but this callback IS called per attempt — so back off hard to
                // turn the 5s WS-upgrade storm into a rare probe against the gone gateway.
                if deactivation_for_delay.is_suspended() {
                    return SUSPENDED_RECONNECT_DELAY;
                }
                warn!(
                    attempt = attempt,
                    hostname = %nats_server_url_for_reconnect,
                    "NATS reconnect attempt"
                );
                std::time::Duration::from_secs(5)
            })
            .ping_interval(std::time::Duration::from_secs(10))
            .event_callback(move |event| {
                let reconnect_tx = reconnect_tx.clone();
                let connected_once = connected_once.clone();
                async move {
                    info!("Nats event: {:?}", event);
                    if matches!(event, Event::Connected)
                        && connected_once.swap(true, Ordering::SeqCst)
                    {
                        let _ = reconnect_tx.send(());
                    }
                }
            })
            .auth_url_callback(move |()| {
                info!("Starting reauthentication");
                let auth_service = auth_service.clone();
                let deactivation = deactivation.clone();
                let nats_server_url = nats_server_url.clone();
                let rotate_now = rotate_now.clone();

                async move {
                    Self::reauthenticate_and_rebuild(
                        auth_service,
                        deactivation,
                        nats_server_url,
                        rotate_now,
                    )
                    .await
                }
            })
            .custom_header("X-MACHINE-ID", &machine_id)
            .custom_header("Authorization", format!("Bearer {token}"));

        // Only add TLS config in development mode
        if self.initial_configuration_service.is_local_mode()? {
            let tls_config = self
                .tls_config_provider
                .create_tls_config()
                .context("Failed to create development TLS configuration")?;
            connect_options = connect_options.tls_client_config(tls_config);
        }

        connect_options
            .connect(&connection_url)
            .await
            .context("Failed to connect to NATS server")
    }

    /// Backstop for a rejected handshake: refresh the token, then wake the rotation supervisor.
    ///
    /// The URL returned here replaces the server address, and it carries no credential — the token
    /// lives in a header that this callback cannot reach, because ConnectOptions froze it. So the
    /// refresh alone cannot rescue this client; the supervisor has to build a new one.
    async fn reauthenticate_and_rebuild(
        auth_service: AgentAuthService,
        deactivation: Arc<DeactivationService>,
        nats_server_url: String,
        rotate_now: Arc<Notify>,
    ) -> std::result::Result<String, async_nats::AuthError> {
        // Tenant gone: skip reauth so NATS reconnects fail locally instead of hammering the gateway.
        if deactivation.is_suspended() {
            return Err(async_nats::AuthError::new(
                "client suspended (tenant gone); skipping NATS reauthentication".to_string(),
            ));
        }

        info!(
            hostname = %nats_server_url,
            "Auth URL callback triggered - performing reauthentication"
        );

        match tokio::time::timeout(
            std::time::Duration::from_secs(10),
            auth_service.reauthenticate(),
        )
        .await
        {
            Ok(Ok(_)) => {
                info!("Reauthentication successful in auth_url_callback");
                rotate_now.notify_one();
                Ok(format!("{}/ws/nats", nats_server_url))
            }
            Ok(Err(e)) => {
                error!("Reauthentication failed in auth_url_callback: {}", e);
                Err(async_nats::AuthError::new(format!(
                    "Reauthentication failed: {}",
                    e
                )))
            }
            Err(_) => {
                error!("Reauthentication timed out in auth_url_callback after 10s");
                Err(async_nats::AuthError::new(
                    "Reauthentication timed out after 10s".to_string(),
                ))
            }
        }
    }

    fn build_nats_connection_url(&self) -> String {
        nats_ws_url(&self.nats_server_url)
    }

    /// Adopts a rotated access token by rebuilding the client.
    ///
    /// TokenRefreshRunManager rewrites the stored token before it expires; this notices the new
    /// value and swaps in a client whose header carries it. Doing that while the old connection is
    /// still healthy is the whole point: async-nats only observes a dropped handle between
    /// reconnect attempts, so a client abandoned mid-reconnect would keep retrying forever with
    /// the stale header.
    fn start_rotation_supervisor(&self) {
        if self.supervisor_started.swap(true, Ordering::SeqCst) {
            return;
        }

        let manager = self.clone();
        tokio::spawn(async move {
            let mut in_use = manager
                .config_service
                .get_access_token()
                .await
                .unwrap_or_default();

            loop {
                tokio::select! {
                    _ = tokio::time::sleep(TOKEN_POLL_INTERVAL) => {}
                    _ = manager.rotate_now.notified() => {}
                }

                // Tenant gone: the auth backoff probe owns recovery, don't build clients into it.
                if manager.deactivation.is_suspended() {
                    continue;
                }

                let current = match manager.config_service.get_access_token().await {
                    Ok(token) => token,
                    Err(e) => {
                        warn!("Rotation supervisor: cannot read the access token: {:#}", e);
                        continue;
                    }
                };
                if current.is_empty() || current == in_use {
                    continue;
                }

                match manager.rebuild().await {
                    Ok(()) => {
                        in_use = current;
                        info!("Rebuilt the NATS client with the rotated access token");
                    }
                    Err(e) => error!("Failed to rebuild the NATS client after rotation: {:#}", e),
                }
            }
        });
    }

    /// Swaps in a client carrying the current token and drains the one it replaces.
    async fn rebuild(&self) -> Result<()> {
        let fresh = Arc::new(self.build_client().await?);

        let previous = {
            let mut guard = self.client.write().await;
            guard.replace(fresh)
        };

        // Drain is the rebind trigger; reconnect_tx here would wedge listeners on the dead client.
        if let Some(previous) = previous {
            if let Err(e) = previous.drain().await {
                warn!("Draining the superseded NATS client failed: {}", e);
            }
        }

        Ok(())
    }

    pub async fn get_client(&self) -> Result<Arc<Client>> {
        let guard = self.client.read().await;
        guard
            .clone()
            .context("NATS client is not initialized. Call connect() first.")
    }
}

/// The NATS WebSocket URL. Carries no credential: the bearer token is sent as an `Authorization`
/// handshake header instead, because a query string ends up verbatim in load-balancer access logs.
fn nats_ws_url(host: &str) -> String {
    format!("{host}/ws/nats")
}

#[cfg(test)]
#[path = "nats_connection_manager_tests.rs"]
mod tests;
