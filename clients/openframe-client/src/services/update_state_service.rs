use crate::models::openframe_client_update_message::OpenFrameClientUpdateMessage;
use crate::models::saved_client_update::SavedClientUpdate;
use crate::models::update_state::UpdateState;
use crate::platform::directories::DirectoryManager;
use crate::services::result_store::now_secs;
use crate::utils::fs::{atomic_write, parse_json_or_quarantine, read_json_or_quarantine, JsonFile};
use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

#[derive(Clone)]
pub struct UpdateStateService {
    state_file_path: PathBuf,
    saved_update_path: PathBuf,
    /// The listener, the retry loop and boot handling all rewrite the saved update
    saved_update_lock: Arc<Mutex<()>>,
}

impl UpdateStateService {
    pub fn new(directory_manager: DirectoryManager) -> Result<Self> {
        let state_file_path = directory_manager.secured_dir().join("update_state.json");
        let saved_update_path = directory_manager
            .secured_dir()
            .join("saved_client_update.json");

        directory_manager
            .ensure_directories()
            .with_context(|| "Failed to ensure secured directory exists")?;

        Ok(Self {
            state_file_path,
            saved_update_path,
            saved_update_lock: Arc::new(Mutex::new(())),
        })
    }

    pub async fn load(&self) -> Result<Option<UpdateState>> {
        Ok(self.read_state().await?.parsed())
    }

    /// Like `load`, but tells a corrupt file from a missing one, which the updater reads as uninstalled.
    pub async fn read_state(&self) -> Result<JsonFile<UpdateState>> {
        info!(
            "Checking for update state file at: {}",
            self.state_file_path.display()
        );

        if !self.state_file_path.exists() {
            info!(
                "No update state file found at: {}",
                self.state_file_path.display()
            );
            return Ok(JsonFile::Missing);
        }

        let content = fs::read(&self.state_file_path).with_context(|| {
            format!(
                "Failed to read update state file: {:?}",
                self.state_file_path
            )
        })?;

        info!(
            "Read update state file content: {}",
            String::from_utf8_lossy(&content)
        );

        let file: JsonFile<UpdateState> = parse_json_or_quarantine(&self.state_file_path, &content);
        if let JsonFile::Parsed(state) = &file {
            info!(
                "Loaded update state for version: {}, phase: {:?}",
                state.target_version, state.phase
            );
        }
        Ok(file)
    }

    pub async fn save(&self, state: &UpdateState) -> Result<()> {
        let json_content = serde_json::to_string_pretty(state)
            .context("Failed to serialize update state to JSON")?;

        atomic_write(&self.state_file_path, json_content).with_context(|| {
            format!(
                "Failed to write update state file: {:?}",
                self.state_file_path
            )
        })?;

        debug!(
            "Saved update state for version: {}, phase: {:?}",
            state.target_version, state.phase
        );
        Ok(())
    }

    pub async fn clear(&self) -> Result<()> {
        if self.state_file_path.exists() {
            fs::remove_file(&self.state_file_path).with_context(|| {
                format!(
                    "Failed to remove update state file: {:?}",
                    self.state_file_path
                )
            })?;

            info!("Cleared update state");
        }
        Ok(())
    }

    pub async fn has_incomplete_update(&self) -> Result<bool> {
        match self.load().await? {
            Some(_state) => Ok(true), // If state exists, recovery is needed
            None => Ok(false),
        }
    }

    pub fn get_state_file_path(&self) -> String {
        self.state_file_path.to_string_lossy().to_string()
    }

    pub async fn load_saved_update(&self) -> Option<SavedClientUpdate> {
        let _lock = self.saved_update_lock.lock().await;
        self.read_saved_update()
    }

    /// The newest message wins: it replaces any saved update and is due right away
    pub async fn save_update(&self, message: OpenFrameClientUpdateMessage) -> Result<()> {
        let _lock = self.saved_update_lock.lock().await;
        self.write_saved_update(&SavedClientUpdate::new(message, now_secs()))
    }

    pub async fn clear_saved_update(&self) -> Result<()> {
        let _lock = self.saved_update_lock.lock().await;
        self.remove_saved_update()
    }

    /// Counts an attempt at the saved update for `version`; false when it was replaced or dropped meanwhile
    pub async fn start_saved_attempt(&self, version: &str) -> Result<bool> {
        let _lock = self.saved_update_lock.lock().await;
        let Some(mut saved) = self
            .read_saved_update()
            .filter(|saved| saved.targets(version))
        else {
            return Ok(false);
        };
        saved.start_attempt(now_secs());
        self.write_saved_update(&saved)?;
        info!(
            "Attempt {} at saved client update {}, the next one not before {}",
            saved.attempts,
            saved.version(),
            format_time(saved.next_attempt_at)
        );
        Ok(true)
    }

    /// Drops the saved update for `version`: it applied, or it no longer applies
    pub async fn clear_saved_update_for(&self, version: &str) -> Result<()> {
        let _lock = self.saved_update_lock.lock().await;
        if self
            .read_saved_update()
            .is_some_and(|saved| saved.targets(version))
        {
            self.remove_saved_update()?;
            info!("Dropped saved client update {}", version);
        }
        Ok(())
    }

    /// After a failed attempt: drops the saved update for `version` once it is past its retry window
    pub async fn expire_saved_update(&self, version: &str) -> Result<()> {
        let _lock = self.saved_update_lock.lock().await;
        let Some(saved) = self
            .read_saved_update()
            .filter(|saved| saved.targets(version))
        else {
            return Ok(());
        };
        if saved.is_expired(now_secs()) {
            self.remove_saved_update()?;
            warn!(
                "Giving up on client update {} after {} attempts since {}",
                saved.version(),
                saved.attempts,
                format_time(saved.received_at)
            );
        } else {
            info!(
                "Client update {} will be retried, not before {}",
                saved.version(),
                format_time(saved.next_attempt_at)
            );
        }
        Ok(())
    }

    fn read_saved_update(&self) -> Option<SavedClientUpdate> {
        match read_json_or_quarantine(&self.saved_update_path) {
            Ok(file) => file.parsed(),
            Err(e) => {
                warn!("Failed to read the saved client update: {:#}", e);
                None
            }
        }
    }

    fn write_saved_update(&self, saved: &SavedClientUpdate) -> Result<()> {
        let json_content = serde_json::to_string_pretty(saved)
            .context("Failed to serialize the saved client update")?;
        atomic_write(&self.saved_update_path, json_content).with_context(|| {
            format!(
                "Failed to write saved client update file: {:?}",
                self.saved_update_path
            )
        })
    }

    fn remove_saved_update(&self) -> Result<()> {
        match fs::remove_file(&self.saved_update_path) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e).with_context(|| {
                format!(
                    "Failed to remove saved client update file: {:?}",
                    self.saved_update_path
                )
            }),
            _ => Ok(()),
        }
    }
}

fn format_time(unix_secs: u64) -> String {
    chrono::DateTime::from_timestamp(unix_secs as i64, 0)
        .map(|time| time.to_rfc3339())
        .unwrap_or_else(|| unix_secs.to_string())
}

#[cfg(test)]
#[path = "update_state_service_tests.rs"]
mod tests;
