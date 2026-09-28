use anyhow::{Context, Result};
use async_nats::{Client, Event};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, watch, RwLock};
use tokio::time::{interval, MissedTickBehavior};
use tracing::{error, info, warn};

use crate::services::agent_configuration_service::AgentConfigurationService;
use crate::services::initial_configuration_service::InitialConfigurationService;
use crate::services::local_tls_config_provider::LocalTlsConfigProvider;

// Connection watchdog — parity with openframe-client: async-nats's event loop can
// stall silently (no traffic, no error, no reconnect); when no bytes move for a
// whole stall window the client is replaced and listeners rebind through
// on_client_replaced().
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
    nats_server_url: String,
    config_service: AgentConfigurationService,
    initial_configuration_service: InitialConfigurationService,
    token: Arc<RwLock<Option<String>>>,
    tls_config_provider: LocalTlsConfigProvider,
    reconnect_tx: broadcast::Sender<()>,
}

impl NatsConnectionManager {
    const NATS_DEVICE_USER: &'static str = "machine";
    const NATS_DEVICE_PASSWORD: &'static str = "";

    pub fn new(
        nats_server_url: String,
        config_service: AgentConfigurationService,
        initial_configuration_service: InitialConfigurationService,
        token: Arc<RwLock<Option<String>>>,
        tls_config_provider: LocalTlsConfigProvider,
    ) -> Self {
        let (reconnect_tx, _) = broadcast::channel(16);
        let (client, _) = watch::channel(None);
        Self {
            client: Arc::new(client),
            last_activity: Arc::new(Mutex::new(Instant::now())),
            nats_server_url,
            config_service,
            initial_configuration_service,
            token,
            tls_config_provider,
            reconnect_tx,
        }
    }

    pub fn subscribe_reconnect(&self) -> broadcast::Receiver<()> {
        self.reconnect_tx.subscribe()
    }

    pub fn on_client_replaced(&self) -> watch::Receiver<Option<Arc<Client>>> {
        self.client.subscribe()
    }

    pub async fn connect(&self) -> Result<()> {
        let machine_id = self.config_service.get_machine_id().await?;

        info!(hostname = %self.nats_server_url, "Connecting to NATS server");

        let connection_url = self.build_nats_connection_url().await?;

        let token = self.token.clone();
        let nats_server_url = self.nats_server_url.clone();
        let nats_server_url_for_reconnect = self.nats_server_url.clone();
        let reconnect_tx = self.reconnect_tx.clone();
        let last_activity = self.last_activity.clone();
        let connected_once = Arc::new(AtomicBool::new(false));

        let mut connect_options = async_nats::ConnectOptions::new()
            .name(machine_id)
            .user_and_password(
                Self::NATS_DEVICE_USER.to_string(),
                Self::NATS_DEVICE_PASSWORD.to_string(),
            )
            .retry_on_initial_connect()
            .max_reconnects(None)
            .reconnect_delay_callback(move |attempt| {
                note_activity(&last_activity);
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
                    info!("NATS event: {:?}", event);
                    if matches!(event, Event::Connected)
                        && connected_once.swap(true, Ordering::SeqCst)
                    {
                        let _ = reconnect_tx.send(());
                    }
                }
            })
            .auth_url_callback(move |()| {
                info!("Auth URL callback triggered — reading latest shared token");
                let token = token.clone();
                let nats_server_url = nats_server_url.clone();

                async move {
                    match token.read().await.clone() {
                        Some(t) => {
                            info!("Built new NATS URL from shared token");
                            Ok(format!("{}/ws/nats?authorization={}", nats_server_url, t))
                        }
                        None => {
                            error!("Shared token not available for NATS re-auth");
                            Err(async_nats::AuthError::new("Shared token not available"))
                        }
                    }
                }
            });

        if self.initial_configuration_service.is_local_mode()? {
            let tls_config = self
                .tls_config_provider
                .create_tls_config()
                .context("Failed to create local-mode TLS configuration")?;
            connect_options = connect_options.tls_client_config(tls_config);
        }

        let client: Client = connect_options
            .connect(&connection_url)
            .await
            .context("Failed to connect to NATS server")?;

        self.client.send_replace(Some(Arc::new(client)));
        note_activity(&self.last_activity);

        info!("Connected to NATS server");
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

    async fn build_nats_connection_url(&self) -> Result<String> {
        let token =
            self.token.read().await.clone().context(
                "Shared token not available — token watcher has not received a token yet",
            )?;
        Ok(format!(
            "{}/ws/nats?authorization={}",
            self.nats_server_url, token
        ))
    }

    pub async fn get_client(&self) -> Result<Arc<Client>> {
        self.client
            .borrow()
            .clone()
            .context("NATS client not initialized — call connect() first")
    }
}
