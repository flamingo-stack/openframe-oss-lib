use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::deactivation_service::DeactivationService;
use crate::services::local_tls_config_provider::LocalTlsConfigProvider;
use crate::services::{
    AgentAuthService, InitialConfigurationService, MachineIdService, MACHINE_ID_HEADER,
};
use anyhow::{Context, Result};
use async_nats::{Client, Event};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, watch};
use tokio::time::{interval, timeout, MissedTickBehavior};
use tracing::{error, info, warn};

/// Reconnect delay while the tenant is gone (suspended): backs the 5s storm off ~60x so a
/// deleted-tenant client barely touches the gateway. Auto-reverts to 5s on recovery.
const SUSPENDED_RECONNECT_DELAY: Duration = Duration::from_secs(5 * 60);

const PROBE_INTERVAL: Duration = Duration::from_secs(15);
const MAX_PROBE_GAP: Duration = Duration::from_secs(45);
const MIN_STALL_WINDOW: Duration = Duration::from_secs(90);
const MAX_STALL_WINDOW: Duration = Duration::from_secs(30 * 60);

fn widen_stall_window(current: Duration) -> Duration {
    (current * 3).min(MAX_STALL_WINDOW)
}

fn note_activity(last_activity: &Mutex<Instant>) {
    *last_activity.lock().unwrap() = Instant::now();
}

fn since_activity(last_activity: &Mutex<Instant>) -> Duration {
    last_activity.lock().unwrap().elapsed()
}

#[derive(Clone)]
pub struct NatsConnectionManager {
    client: Arc<watch::Sender<Option<Arc<Client>>>>,
    last_activity: Arc<Mutex<Instant>>,
    reconnect_tx: broadcast::Sender<()>,
    nats_server_url: String,
    config_service: AgentConfigurationService,
    tls_config_provider: LocalTlsConfigProvider,
    initial_configuration_service: InitialConfigurationService,
    auth_service: AgentAuthService,
    deactivation: Arc<DeactivationService>,
    machine_id_service: MachineIdService,
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
        machine_id_service: MachineIdService,
    ) -> Self {
        let (reconnect_tx, _) = broadcast::channel(16);
        let (client, _) = watch::channel(None);
        Self {
            client: Arc::new(client),
            last_activity: Arc::new(Mutex::new(Instant::now())),
            reconnect_tx,
            nats_server_url: nats_server_url.to_string(),
            config_service,
            tls_config_provider,
            initial_configuration_service,
            auth_service,
            deactivation,
            machine_id_service,
        }
    }

    pub fn subscribe_reconnect(&self) -> broadcast::Receiver<()> {
        self.reconnect_tx.subscribe()
    }

    pub fn on_client_replaced(&self) -> watch::Receiver<Option<Arc<Client>>> {
        self.client.subscribe()
    }

    pub async fn connect(&self) -> Result<()> {
        // Server-assigned machine_id names the NATS connection; the local one goes in the header
        let machine_id = self.config_service.get_machine_id()?;
        let local_machine_id = self.machine_id_service.get();

        info!(
            hostname = %self.nats_server_url,
            "Connecting to NATS server"
        );

        let connection_url = self.build_nats_connection_url().await?;

        // Cloned dependencies for auth callback
        let auth_service = self.auth_service.clone();
        let config_service = self.config_service.clone();
        let deactivation = self.deactivation.clone();
        let deactivation_for_delay = self.deactivation.clone();
        let nats_server_url = self.nats_server_url.clone();
        let nats_server_url_for_reconnect = self.nats_server_url.clone();
        let reconnect_tx = self.reconnect_tx.clone();
        let last_activity = self.last_activity.clone();
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
                note_activity(&last_activity);

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
                Duration::from_secs(5)
            })
            .ping_interval(Duration::from_secs(10))
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
                let config_service = config_service.clone();
                let deactivation = deactivation.clone();
                let nats_server_url = nats_server_url.clone();

                async move {
                    Self::perform_reauthentication_and_build_url(
                        auth_service,
                        config_service,
                        deactivation,
                        nats_server_url,
                    )
                    .await
                }
            })
            .custom_header(MACHINE_ID_HEADER, &local_machine_id);

        // Only add TLS config in development mode
        if self.initial_configuration_service.is_local_mode()? {
            let tls_config = self
                .tls_config_provider
                .create_tls_config()
                .context("Failed to create development TLS configuration")?;
            connect_options = connect_options.tls_client_config(tls_config);
        }

        let client = connect_options
            .connect(&connection_url)
            .await
            .context("Failed to connect to NATS server")?;

        self.client.send_replace(Some(Arc::new(client)));
        note_activity(&self.last_activity);

        Ok(())
    }

    pub fn start_connection_watchdog(&self) {
        let this = self.clone();

        info!("Starting NATS connection watchdog");

        tokio::spawn(async move {
            let mut probe = interval(PROBE_INTERVAL);
            probe.set_missed_tick_behavior(MissedTickBehavior::Delay);

            let mut stall_window = MIN_STALL_WINDOW;
            let mut last_seen = (0, 0);
            let mut healthy_since = Instant::now();
            let mut suspension_grace_until = Instant::now();
            let mut last_tick = Instant::now();
            let mut replacements: u64 = 0;

            loop {
                probe.tick().await;

                let gap = last_tick.elapsed();
                last_tick = Instant::now();
                if gap > MAX_PROBE_GAP {
                    warn!(
                        gap_s = gap.as_secs(),
                        "Watchdog was not scheduled; re-arming instead of judging the connector"
                    );
                    note_activity(&this.last_activity);
                    healthy_since = Instant::now();
                    continue;
                }

                if this.deactivation.is_suspended() {
                    suspension_grace_until = Instant::now() + SUSPENDED_RECONNECT_DELAY;
                }
                if Instant::now() < suspension_grace_until {
                    note_activity(&this.last_activity);
                    continue;
                }

                let Ok(client) = this.get_client().await else {
                    continue;
                };

                let stats = client.statistics();
                let seen = (
                    stats.in_bytes.load(Ordering::Relaxed),
                    stats.out_bytes.load(Ordering::Relaxed),
                );
                if seen != last_seen {
                    last_seen = seen;
                    note_activity(&this.last_activity);
                    if healthy_since.elapsed() >= MIN_STALL_WINDOW {
                        stall_window = MIN_STALL_WINDOW;
                    }
                    continue;
                }
                healthy_since = Instant::now();

                let idle = since_activity(&this.last_activity);
                if idle < stall_window {
                    continue;
                }

                replacements += 1;
                error!(
                    idle_s = idle.as_secs(),
                    state = ?client.connection_state(),
                    replacements = replacements,
                    "NATS event loop stalled; replacing the client"
                );
                drop(client);

                note_activity(&this.last_activity);
                match this.connect().await {
                    Ok(()) => {
                        info!("Replaced stalled NATS client");
                        stall_window = widen_stall_window(stall_window);
                    }
                    Err(e) => error!("Failed to replace stalled NATS client: {:#}", e),
                }
                last_seen = (0, 0);
            }
        });
    }

    async fn perform_reauthentication_and_build_url(
        auth_service: AgentAuthService,
        config_service: AgentConfigurationService,
        deactivation: Arc<DeactivationService>,
        nats_server_url: String,
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

        match timeout(Duration::from_secs(10), auth_service.reauthenticate()).await {
            Ok(Ok(_)) => {
                info!("Reauthentication successful in auth_url_callback");

                match config_service.get_access_token().await {
                    Ok(token) => {
                        let new_url =
                            format!("{}/ws/nats?authorization={}", nats_server_url, token);
                        info!("Built new NATS URL with fresh token");
                        Ok(new_url)
                    }
                    Err(e) => {
                        error!("Failed to get access token after reauthentication: {}", e);
                        Err(async_nats::AuthError::new(format!(
                            "Failed to get token: {}",
                            e
                        )))
                    }
                }
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

    async fn build_nats_connection_url(&self) -> Result<String> {
        let token = self.config_service.get_access_token().await?;
        let host = &self.nats_server_url;
        Ok(format!("{}/ws/nats?authorization={}", host, token))
    }

    pub async fn get_client(&self) -> Result<Arc<Client>> {
        self.client
            .borrow()
            .clone()
            .context("NATS client is not initialized. Call connect() first.")
    }
}

#[cfg(test)]
#[path = "nats_connection_manager_tests.rs"]
mod tests;
