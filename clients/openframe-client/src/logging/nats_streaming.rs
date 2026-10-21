use anyhow::{Context, Result};
use async_nats::jetstream;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::time::{interval, Duration, Instant};
use tracing::{debug, error, info, warn};

use crate::platform::DirectoryManager;
use crate::services::backend_call_retry::RetryTiming;
use crate::services::device_data_fetcher::DeviceDataFetcher;
use crate::services::{
    AgentConfigurationService, InitialConfigurationService, InstalledToolsService, LogKeyService,
    MachineIdService, MACHINE_ID_HEADER,
};

use super::log_parser::LogBatchMessage;
use super::log_rotation::LogRotationManager;
use super::log_source::{FileLogSource, LogSource, LogSourceKind, LogSourceRegistry};

const BATCH_INTERVAL_SECS: u64 = 60;
const MAX_LOGS_PER_BATCH: usize = 50;
const RECONNECT_DELAY_SECS: u64 = 5;
// Bounds the client's own retry loop so an abandoned connection stops dialing; the streaming loop rebuilds after that.
const MAX_RECONNECT_ATTEMPTS: usize = 12;
const REBUILD_TIMING: RetryTiming = RetryTiming {
    initial: Duration::from_secs(60),
    max: Duration::from_secs(600),
};
const KEY_CHECK_INTERVAL_SECS: u64 = 10;
const SOURCE_DISCOVERY_INTERVAL_SECS: u64 = 30;
const NATS_SUBJECT: &str = "agents.logs";

/// Credential handed to the logs gateway: the log key, or the enrollment key on devices registered before log keys existed.
#[derive(Debug, Clone, PartialEq)]
pub enum LogStreamKey {
    Log(String),
    Initial(String),
}

impl LogStreamKey {
    fn header(&self) -> (&'static str, &str) {
        match self {
            Self::Log(key) => ("x-log-key", key),
            Self::Initial(key) => ("x-initial-key", key),
        }
    }

    fn kind(&self) -> &'static str {
        match self {
            Self::Log(_) => "log key",
            Self::Initial(_) => "initial key",
        }
    }
}

/// Flags the client's event callback raises for the streaming loop, which owns rebuilding the connection.
#[derive(Default)]
struct ConnectionState {
    connected: AtomicBool,
    // The gateway rejected the key on the handshake; cleared once a handshake succeeds.
    key_rejected: AtomicBool,
    // The client gave up reconnecting; it will never publish again.
    exhausted: AtomicBool,
}

impl ConnectionState {
    fn on_event(&self, event: &async_nats::Event) {
        match event {
            async_nats::Event::Connected => {
                self.connected.store(true, Ordering::Relaxed);
                self.key_rejected.store(false, Ordering::Relaxed);
            }
            async_nats::Event::Disconnected => self.connected.store(false, Ordering::Relaxed),
            async_nats::Event::ClientError(async_nats::ClientError::MaxReconnects) => {
                self.exhausted.store(true, Ordering::Relaxed)
            }
            async_nats::Event::ClientError(err) if is_authorization_error(&err.to_string()) => {
                self.key_rejected.store(true, Ordering::Relaxed)
            }
            _ => {}
        }
    }
}

pub struct NatsLogConnection {
    jetstream: Option<jetstream::Context>,
    server_host: String,
    tenant_domain: String,
    key: LogStreamKey,
    machine_id: String,
    state: Arc<ConnectionState>,
}

impl NatsLogConnection {
    pub fn new(
        server_host: String,
        tenant_domain: String,
        key: LogStreamKey,
        machine_id: String,
    ) -> Self {
        Self {
            jetstream: None,
            server_host,
            tenant_domain,
            key,
            machine_id,
            state: Arc::new(ConnectionState::default()),
        }
    }

    pub async fn connect(&mut self) -> Result<()> {
        let url = format!("wss://{}/ws/nats-logs", self.server_host);
        info!(
            "NATS logs: connecting to {} (tenant={}, auth={})",
            url,
            self.tenant_domain,
            self.key.kind()
        );

        let tenant_domain = self.tenant_domain.clone();
        let state = self.state.clone();
        let (key_header, key_value) = self.key.header();
        let client = async_nats::ConnectOptions::new()
            .custom_header("x-tenant-domain", &self.tenant_domain)
            .custom_header(key_header, key_value)
            .custom_header(MACHINE_ID_HEADER, &self.machine_id)
            .retry_on_initial_connect()
            .max_reconnects(Some(MAX_RECONNECT_ATTEMPTS))
            .reconnect_delay_callback(|attempt| {
                let delay = Duration::from_secs(RECONNECT_DELAY_SECS);
                error!("NATS logs: reconnecting, attempt {}", attempt);
                delay
            })
            .event_callback(move |event| {
                let tenant = tenant_domain.clone();
                let state = state.clone();
                async move {
                    state.on_event(&event);
                    match event {
                        async_nats::Event::Connected => {
                            info!("NATS logs: connected (tenant={})", tenant);
                        }
                        async_nats::Event::Disconnected => {
                            error!("NATS logs: disconnected (tenant={})", tenant);
                        }
                        async_nats::Event::ServerError(err) => {
                            error!("NATS logs: server error: {} (tenant={})", err, tenant);
                        }
                        async_nats::Event::ClientError(err) => {
                            error!("NATS logs: client error: {} (tenant={})", err, tenant);
                        }
                        _ => {}
                    }
                }
            })
            .connect(&url)
            .await
            .context("Failed to connect to NATS logs endpoint")?;

        self.jetstream = Some(jetstream::new(client));
        info!("NATS logs: initial connection established");
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.state.connected.load(Ordering::Relaxed)
    }

    fn key_rejected(&self) -> bool {
        self.state.key_rejected.load(Ordering::Relaxed)
    }

    /// True when this client will not recover on its own and must be replaced.
    fn needs_rebuild(&self) -> bool {
        self.key_rejected() || self.state.exhausted.load(Ordering::Relaxed)
    }

    pub async fn publish(&self, payload: &LogBatchMessage) -> Result<()> {
        let js = self
            .jetstream
            .as_ref()
            .context("NATS log connection not initialized")?;

        let json = serde_json::to_vec(payload).context("Failed to serialize log batch")?;

        js.publish(NATS_SUBJECT, json.into())
            .await
            .context("Failed to publish log batch")?
            .await
            .context("Failed to receive publish acknowledgment")?;

        debug!(
            "Published {} logs to NATS (ack received)",
            payload.logs.len()
        );
        Ok(())
    }
}

/// The gateway answers a rejected key with HTTP 401, which the NATS client reports as an authorization violation.
fn is_authorization_error(client_error: &str) -> bool {
    client_error.contains("authorization violation")
}

/// Key for the connection that replaces a failed one.
#[derive(Debug, PartialEq)]
enum Replacement {
    Use(LogStreamKey),
    Fetch,
    Keep,
}

/// A key on disk that differs from the rejected one wins; the same key must be fetched again; an exhausted client reuses what is on disk.
fn replacement_for(
    current: &LogStreamKey,
    rejected: bool,
    stored: Option<LogStreamKey>,
) -> Replacement {
    match (rejected, stored) {
        (false, Some(key)) => Replacement::Use(key),
        (false, None) => Replacement::Keep,
        (true, Some(key)) if key != *current => Replacement::Use(key),
        (true, _) => Replacement::Fetch,
    }
}

pub struct LogStreamingRunManager {
    server_host: String,
    tenant_domain: String,
    hostname: String,
    log_file_path: PathBuf,
    offset_file_path: PathBuf,
    initial_config_service: InitialConfigurationService,
    agent_config_service: AgentConfigurationService,
    log_key_service: Arc<LogKeyService>,
    installed_tools_service: InstalledToolsService,
    directory_manager: DirectoryManager,
    machine_id: String,
}

impl LogStreamingRunManager {
    pub fn new(
        initial_config_service: &InitialConfigurationService,
        agent_config_service: &AgentConfigurationService,
        log_key_service: Arc<LogKeyService>,
        installed_tools_service: &InstalledToolsService,
        directory_manager: &DirectoryManager,
    ) -> Result<Self> {
        let server_host = initial_config_service.get_server_url()?;
        let tenant_domain = extract_tenant_domain(&server_host);

        let device_data_fetcher = DeviceDataFetcher::new();
        let hostname = device_data_fetcher
            .get_hostname()
            .unwrap_or_else(|| "unknown".to_string());

        let log_file_path = directory_manager.logs_dir().join("openframe.log");
        let offset_file_path = directory_manager.secured_dir().join("log_stream_offset");
        let machine_id = MachineIdService::new(directory_manager).get_or_create()?;

        Ok(Self {
            server_host,
            tenant_domain,
            hostname,
            log_file_path,
            offset_file_path,
            initial_config_service: initial_config_service.clone(),
            agent_config_service: agent_config_service.clone(),
            log_key_service,
            installed_tools_service: installed_tools_service.clone(),
            directory_manager: directory_manager.clone(),
            machine_id,
        })
    }

    pub async fn start(self) -> Result<()> {
        tokio::spawn(async move {
            let key = self.wait_for_key().await;
            let mut connection = self.build_connection(key);

            loop {
                match connection.connect().await {
                    Ok(()) => break,
                    Err(e) => {
                        error!(
                            "Failed to connect to NATS logs: {:#}, retrying in {}s",
                            e, RECONNECT_DELAY_SECS
                        );
                        tokio::time::sleep(Duration::from_secs(RECONNECT_DELAY_SECS)).await;
                    }
                }
            }

            let registry = self.create_source_registry();

            let rotation_manager =
                LogRotationManager::new(self.log_file_path.clone(), self.offset_file_path.clone());

            let (source_tx, source_rx) = mpsc::channel::<Box<dyn LogSource>>(4);

            spawn_source_discovery(
                source_tx,
                self.installed_tools_service.clone(),
                self.directory_manager.clone(),
            );

            self.stream(registry, source_rx, rotation_manager, connection)
                .await;
        });

        Ok(())
    }

    fn create_source_registry(&self) -> LogSourceRegistry {
        let mut registry = LogSourceRegistry::new();

        let source = FileLogSource::new(
            LogSourceKind::Openframe,
            self.log_file_path.clone(),
            self.offset_file_path.clone(),
        );
        registry.register(Box::new(source));

        registry
    }

    fn build_connection(&self, key: LogStreamKey) -> NatsLogConnection {
        NatsLogConnection::new(
            self.server_host.clone(),
            self.tenant_domain.clone(),
            key,
            self.machine_id.clone(),
        )
    }

    /// The log key once the device holds one, else the enrollment key still on disk.
    fn stored_key(&self) -> Option<LogStreamKey> {
        if let Some(key) = self.log_key_service.stored_key() {
            return Some(LogStreamKey::Log(key));
        }
        self.initial_config_service
            .get_initial_key()
            .ok()
            .filter(|key| !key.is_empty())
            .map(LogStreamKey::Initial)
    }

    async fn wait_for_key(&self) -> LogStreamKey {
        loop {
            if let Some(key) = self.stored_key() {
                info!("NATS log streaming: {} available, starting", key.kind());
                return key;
            }
            debug!("NATS log streaming: waiting for a key...");
            tokio::time::sleep(Duration::from_secs(KEY_CHECK_INTERVAL_SECS)).await;
        }
    }

    /// Replaces a client whose key was rejected or whose reconnects ran out.
    async fn rebuild(&self, connection: &mut NatsLogConnection) {
        let key = match replacement_for(
            &connection.key,
            connection.key_rejected(),
            self.stored_key(),
        ) {
            Replacement::Use(key) => key,
            Replacement::Keep => return,
            Replacement::Fetch => match self.log_key_service.refresh().await {
                Ok(key) => LogStreamKey::Log(key),
                Err(e) => {
                    warn!(
                        "NATS logs: key rejected, could not fetch a fresh one: {:#}",
                        e
                    );
                    return;
                }
            },
        };

        let mut fresh = self.build_connection(key);
        match fresh.connect().await {
            Ok(()) => *connection = fresh,
            Err(e) => error!("NATS logs: failed to rebuild the connection: {:#}", e),
        }
    }

    async fn stream(
        self,
        mut registry: LogSourceRegistry,
        mut source_rx: mpsc::Receiver<Box<dyn LogSource>>,
        rotation_manager: LogRotationManager,
        mut connection: NatsLogConnection,
    ) {
        let mut ticker = interval(Duration::from_secs(BATCH_INTERVAL_SECS));
        let mut file_position: u64 = rotation_manager.load_offset();
        let mut rebuild_delay = REBUILD_TIMING.initial;
        let mut rebuild_allowed_at = Instant::now();

        loop {
            ticker.tick().await;

            // Drain any newly discovered sources
            while let Ok(source) = source_rx.try_recv() {
                registry.register(source);
            }

            if connection.is_connected() {
                rebuild_delay = REBUILD_TIMING.initial;
            } else if connection.needs_rebuild() && Instant::now() >= rebuild_allowed_at {
                self.rebuild(&mut connection).await;
                rebuild_allowed_at = Instant::now() + rebuild_delay;
                rebuild_delay = REBUILD_TIMING.next(rebuild_delay);
            }

            let logs = registry.read_all(MAX_LOGS_PER_BATCH);

            if logs.is_empty() {
                rotation_manager.rotate_if_ready(&mut file_position);
                continue;
            }

            let machine_id = self.agent_config_service.get_machine_id().ok();
            let organization_id = self
                .initial_config_service
                .get_org_id()
                .ok()
                .filter(|id| !id.trim().is_empty());

            let batch = LogBatchMessage {
                machine_id,
                hostname: self.hostname.clone(),
                tenant_domain: self.tenant_domain.clone(),
                organization_id,
                logs,
            };

            if let Err(e) = connection.publish(&batch).await {
                error!("Failed to publish log batch: {:#} - will retry", e);
                registry.rollback_all();
            } else {
                registry.commit_all();
                if let Ok(metadata) = std::fs::metadata(&self.log_file_path) {
                    file_position = metadata.len();
                    rotation_manager.save_offset(file_position);
                }
            }
        }
    }
}

fn spawn_source_discovery(
    tx: mpsc::Sender<Box<dyn LogSource>>,
    installed_tools_service: InstalledToolsService,
    directory_manager: DirectoryManager,
) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(SOURCE_DISCOVERY_INTERVAL_SECS)).await;

            match create_meshcentral_source(&installed_tools_service, &directory_manager).await {
                Some(source) => {
                    info!("Meshcentral log source discovered, registering");
                    if tx.send(source).await.is_err() {
                        return;
                    }
                    return;
                }
                None => {
                    debug!(
                        "Meshcentral not installed yet, will retry in {}s",
                        SOURCE_DISCOVERY_INTERVAL_SECS
                    );
                }
            }
        }
    });
}

async fn create_meshcentral_source(
    installed_tools_service: &InstalledToolsService,
    directory_manager: &DirectoryManager,
) -> Option<Box<dyn LogSource>> {
    let meshcentral_id = LogSourceKind::Meshcentral.to_string();

    let tools = installed_tools_service.get_all().await.ok()?;
    let tool = tools
        .into_iter()
        .find(|t| t.tool_agent_id == meshcentral_id)?;
    tool.installation.executable_path()?;

    let tool_dir = directory_manager.app_support_dir().join(&meshcentral_id);
    let log_path = tool_dir.join(format!("{}.log", meshcentral_id));
    let offset_path = directory_manager
        .secured_dir()
        .join("meshcentral_log_offset");

    let source = FileLogSource::new(LogSourceKind::Meshcentral, log_path, offset_path);
    Some(Box::new(source))
}

fn extract_tenant_domain(server_host: &str) -> String {
    server_host
        .strip_prefix("api.")
        .unwrap_or(server_host)
        .to_string()
}

#[cfg(test)]
#[path = "nats_streaming_tests.rs"]
mod tests;
