use crate::config::update_config::{
    CLIENT_UPDATE_BUSY_PARK_SECS, CLIENT_UPDATE_RETRY_CHECK_SECS, CLIENT_UPDATE_RETRY_DELAYS_SECS,
    CLIENT_UPDATE_RETRY_GIVE_UP_SECS,
};
use crate::models::OpenFrameClientUpdateMessage;
use crate::platform::directories::DirectoryManager;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::openframe_client_update_service::{
    canonical_version, OpenFrameClientUpdateService, UpdateGuard, UpdateLaunch,
};
use crate::services::tool_run_manager::ToolRunManager;
use crate::utils::fs::{atomic_write, read_json_or_quarantine, JsonFile};
use anyhow::{Context, Result};
use async_nats::connection::State;
use chrono::{DateTime, TimeDelta, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;
use tokio::sync::broadcast::error::RecvError;
use tokio::time::{interval_at, Instant, MissedTickBehavior};
use tracing::{error, info, warn};

/// A legacy client update message, kept as the backend sent it until it is installed, superseded or given up.
#[derive(Debug, Serialize, Deserialize)]
struct PendingClientUpdate {
    message: OpenFrameClientUpdateMessage,
    received_at: DateTime<Utc>,
    #[serde(default)]
    attempts: u32,
    #[serde(default)]
    last_attempt_at: Option<DateTime<Utc>>,
}

impl PendingClientUpdate {
    fn new(message: OpenFrameClientUpdateMessage, now: DateTime<Utc>) -> Self {
        Self {
            message,
            received_at: now,
            attempts: 0,
            last_attempt_at: None,
        }
    }

    /// A last attempt in the future means the clock went back, which must not hold the retry off.
    fn is_due(&self, now: DateTime<Utc>) -> bool {
        self.last_attempt_at
            .is_none_or(|last| last > now || now >= last + retry_delay(self.attempts))
    }

    /// Still saved after an attempt that began past the deadline, so that attempt failed.
    fn has_expired(&self, now: DateTime<Utc>) -> bool {
        self.last_attempt_at.is_some_and(|last| {
            last <= now
                && last >= self.received_at + TimeDelta::seconds(CLIENT_UPDATE_RETRY_GIVE_UP_SECS)
        })
    }
}

fn retry_delay(attempts: u32) -> TimeDelta {
    let index = (attempts.max(1) as usize - 1).min(CLIENT_UPDATE_RETRY_DELAYS_SECS.len() - 1);
    TimeDelta::seconds(CLIENT_UPDATE_RETRY_DELAYS_SECS[index])
}

#[derive(Default)]
struct RetryClock {
    /// Since when the saved update has been waiting for busy tools
    busy_since: Option<Instant>,
    /// Set once the busy hold is over and parked tool operations were released
    hold_ended: bool,
    launched_at: Option<Instant>,
}

/// Retries a failed legacy (broadcast) client update from a saved copy of its message; the delivery engine retries its own.
#[derive(Clone)]
pub struct ClientUpdateRetryService {
    pending_file_path: PathBuf,
    update_service: OpenFrameClientUpdateService,
    tool_run_manager: ToolRunManager,
    nats_connection_manager: NatsConnectionManager,
    /// Held over every read and write of the saved message
    clock: Arc<Mutex<RetryClock>>,
}

impl ClientUpdateRetryService {
    pub fn new(
        directory_manager: &DirectoryManager,
        update_service: OpenFrameClientUpdateService,
        tool_run_manager: ToolRunManager,
        nats_connection_manager: NatsConnectionManager,
    ) -> Self {
        Self {
            pending_file_path: directory_manager
                .secured_dir()
                .join("pending_client_update.json"),
            update_service,
            tool_run_manager,
            nats_connection_manager,
            clock: Arc::new(Mutex::new(RetryClock::default())),
        }
    }

    /// Saves the message in place of any older one, due right away; false when it is not retried locally.
    pub fn remember(&self, message: &OpenFrameClientUpdateMessage) -> bool {
        // the Linux updater is not implemented, so every attempt would fail before launch
        if cfg!(target_os = "linux") {
            return false;
        }
        let mut clock = self.lock();
        let Some(version) = canonical_version(&message.version) else {
            warn!(
                "Client update version '{}' is invalid, not saving it for retry",
                message.version
            );
            return false;
        };
        if version == env!("OPENFRAME_VERSION") {
            self.remove("a message for the running version replaced it");
            return false;
        }

        clock.busy_since = None;
        clock.hold_ended = false;
        match self.save(&PendingClientUpdate::new(message.clone(), Utc::now())) {
            Ok(()) => {
                info!(
                    "Saved client update to {} to retry until installed",
                    version
                );
                true
            }
            Err(e) => {
                warn!(
                    "Failed to save client update to {} for retry, leaving it to redelivery: {:#}",
                    version, e
                );
                false
            }
        }
    }

    /// Drops the saved update, if any.
    pub fn discard(&self, reason: &str) {
        let _clock = self.lock();
        self.remove(reason);
    }

    pub fn start(&self) {
        info!("Starting client update retry");
        tokio::spawn(self.clone().run());
    }

    async fn run(self) {
        let mut reconnect_rx = self.nats_connection_manager.subscribe_reconnect();
        let period = Duration::from_secs(CLIENT_UPDATE_RETRY_CHECK_SECS);
        let mut ticks = interval_at(Instant::now() + period, period);
        ticks.set_missed_tick_behavior(MissedTickBehavior::Delay);

        loop {
            tokio::select! {
                _ = ticks.tick() => {}
                received = reconnect_rx.recv() => {
                    if let Err(RecvError::Closed) = received {
                        error!("Reconnect channel closed, stopping client update retry");
                        return;
                    }
                }
            }
            // the download goes through the same tenant host, so an offline attempt would only burn a retry
            if self.is_connected().await {
                self.run_due().await;
            }
        }
    }

    async fn is_connected(&self) -> bool {
        self.nats_connection_manager
            .get_client()
            .await
            .is_ok_and(|client| matches!(client.connection_state(), State::Connected))
    }

    /// Runs the saved update if its retry is due; a freshly saved message is due at once.
    pub async fn run_due(&self) {
        let Some((message, guard)) = self.begin_due_attempt() else {
            return;
        };
        let version = message.version.clone();
        match self.update_service.apply(message, guard).await {
            Ok(UpdateLaunch::Launched) => self.lock().launched_at = Some(Instant::now()),
            Ok(UpdateLaunch::Skipped) => {
                let _clock = self.lock();
                let saved = self.load().map(|pending| pending.message.version);
                if saved
                    .is_some_and(|saved| canonical_version(&saved) == canonical_version(&version))
                {
                    self.remove("there is nothing to install");
                }
            }
            Err(e) => {
                warn!(
                    "Client update to {} failed, retrying it later: {:#}",
                    version, e
                );
                // the next attempt is at least the first retry delay away
                self.tool_run_manager.clear_client_update_pending();
            }
        }
    }

    /// Takes the update slot for a due retry and counts the attempt before the updater can stop this process.
    fn begin_due_attempt(&self) -> Option<(OpenFrameClientUpdateMessage, UpdateGuard)> {
        let mut clock = self.lock();
        let mut pending = self.load()?;
        let now = Utc::now();

        match canonical_version(&pending.message.version) {
            None => {
                self.remove("its version is invalid");
                return None;
            }
            Some(version) if version == env!("OPENFRAME_VERSION") => {
                self.remove("it is installed");
                return None;
            }
            Some(_) => {}
        }
        if !pending.is_due(now) {
            return None;
        }
        if pending.has_expired(now) {
            self.remove("an attempt a week after it arrived still failed");
            return None;
        }
        // the updater may still be on its way to stopping this process
        let launch_grace = Duration::from_secs(CLIENT_UPDATE_RETRY_DELAYS_SECS[0] as u64);
        if clock
            .launched_at
            .is_some_and(|at| at.elapsed() < launch_grace)
        {
            return None;
        }

        let park_tools = clock.busy_since.is_none_or(|since| {
            since.elapsed() < Duration::from_secs(CLIENT_UPDATE_BUSY_PARK_SECS)
        });
        // past the hold, reserve() would park new tool operations again, so the update just waits for idle tools
        if !park_tools && self.update_service.tools_busy() {
            if !clock.hold_ended {
                clock.hold_ended = true;
                self.tool_run_manager.clear_client_update_pending();
                info!(
                    "Tools still busy after {} minutes, the client update now waits for them without parking tool operations",
                    CLIENT_UPDATE_BUSY_PARK_SECS / 60
                );
            }
            return None;
        }
        let Ok(guard) = self.update_service.reserve(&pending.message) else {
            // a busy tool starts the hold, another update in progress does not
            if self.update_service.tools_busy() {
                clock.busy_since.get_or_insert_with(Instant::now);
            }
            return None;
        };
        clock.busy_since = None;
        clock.hold_ended = false;

        pending.attempts += 1;
        pending.last_attempt_at = Some(now);
        if let Err(e) = self.save(&pending) {
            warn!(
                "Failed to record the client update attempt, not starting it: {:#}",
                e
            );
            self.tool_run_manager.clear_client_update_pending();
            return None;
        }
        info!(
            "Starting client update to {} (attempt {}, received {})",
            pending.message.version, pending.attempts, pending.received_at
        );
        Some((pending.message, guard))
    }

    fn lock(&self) -> MutexGuard<'_, RetryClock> {
        self.clock.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn load(&self) -> Option<PendingClientUpdate> {
        match read_json_or_quarantine(&self.pending_file_path) {
            Ok(JsonFile::Parsed(pending)) => Some(pending),
            Ok(JsonFile::Missing | JsonFile::Corrupt) => None,
            Err(e) => {
                warn!("Failed to read the saved client update: {:#}", e);
                None
            }
        }
    }

    fn save(&self, pending: &PendingClientUpdate) -> Result<()> {
        let json_content = serde_json::to_string_pretty(pending)
            .context("Failed to serialize the saved client update")?;
        atomic_write(&self.pending_file_path, json_content).with_context(|| {
            format!(
                "Failed to write saved client update: {:?}",
                self.pending_file_path
            )
        })
    }

    fn remove(&self, reason: &str) {
        match std::fs::remove_file(&self.pending_file_path) {
            Ok(()) => info!("Dropped the saved client update: {}", reason),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => warn!("Failed to drop the saved client update ({}): {}", reason, e),
        }
    }
}

#[cfg(all(test, not(target_os = "linux")))]
#[path = "client_update_retry_service_tests.rs"]
mod tests;
