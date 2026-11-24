use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::platform::machine_info_persistence;
use crate::platform::DirectoryManager;
use crate::utils::fs::atomic_write;

pub const MACHINE_ID_HEADER: &str = "x-machine-id";

pub(crate) trait SavedMachineId: Send + Sync {
    fn read(&self) -> Option<String>;
    fn save(&self, id: &str);
}

struct PersistedMachineInfoStore;

impl SavedMachineId for PersistedMachineInfoStore {
    fn read(&self) -> Option<String> {
        match machine_info_persistence::read() {
            Ok(info) => info.and_then(|info| info.local_machine_id),
            Err(e) => {
                debug!("Cannot read the saved machine ID: {:#}", e);
                None
            }
        }
    }

    fn save(&self, id: &str) {
        let mut info = match machine_info_persistence::read() {
            Ok(Some(info)) => info,
            Ok(None) => return,
            Err(e) => {
                debug!("Cannot read machine info to save the machine ID: {:#}", e);
                return;
            }
        };
        if info.local_machine_id.as_deref() == Some(id) {
            return;
        }
        info.local_machine_id = Some(id.to_string());
        if let Err(e) = machine_info_persistence::write(&info) {
            warn!(
                "Failed to save the machine ID with the machine info: {:#}",
                e
            );
        }
    }
}

// Locally generated machine identity, distinct from the server-assigned machine_id in agent config.
// Persisted in the shared app-support dir so integrated tool agents (mesh, fleet) can read it.
#[derive(Clone)]
pub struct MachineIdService {
    file_path: PathBuf,
    cached_id: Arc<std::sync::RwLock<Option<String>>>,
    saved: Arc<dyn SavedMachineId>,
}

impl MachineIdService {
    pub fn new(directory_manager: &DirectoryManager) -> Self {
        Self::with_saved(directory_manager, Arc::new(PersistedMachineInfoStore))
    }

    pub(crate) fn with_saved(
        directory_manager: &DirectoryManager,
        saved: Arc<dyn SavedMachineId>,
    ) -> Self {
        Self {
            file_path: directory_manager.app_support_dir().join("machine_id"),
            cached_id: Arc::new(std::sync::RwLock::new(None)),
            saved,
        }
    }

    pub fn get_or_create(&self) -> Result<String> {
        if let Some(id) = self.cached_id.read().unwrap().clone() {
            return Ok(id);
        }

        let id = match self.read() {
            Ok(id) => {
                debug!("Using existing machine ID: {}", id);
                id
            }
            Err(e) => {
                if self.file_path.exists() {
                    warn!("{:#}; restoring or generating a machine ID", e);
                }
                self.restore_or_generate()?
            }
        };
        self.saved.save(&id);
        *self.cached_id.write().unwrap() = Some(id.clone());
        Ok(id)
    }

    fn restore_or_generate(&self) -> Result<String> {
        if let Some(id) = self.saved.read().filter(|id| Uuid::parse_str(id).is_ok()) {
            self.write(&id)?;
            info!("Restored machine ID saved with the machine info: {}", id);
            return Ok(id);
        }
        let id = Uuid::new_v4().to_string();
        self.write(&id)?;
        info!("Generated new machine ID: {}", id);
        Ok(id)
    }

    pub fn renew_if_restored(&self, restored: Option<&str>) -> Result<()> {
        let current = self.get_or_create()?;
        if restored != Some(current.as_str()) {
            return Ok(());
        }
        let id = Uuid::new_v4().to_string();
        self.write(&id)?;
        *self.cached_id.write().unwrap() = Some(id.clone());
        info!(
            "Generated new machine ID {} for a new machine, replacing the restored {}",
            id, current
        );
        Ok(())
    }

    pub fn keep_with_machine_info(&self) {
        if let Ok(id) = self.read() {
            self.saved.save(&id);
        }
    }

    // Cached id only; empty string until get_or_create has run.
    pub fn get(&self) -> String {
        self.cached_id.read().unwrap().clone().unwrap_or_default()
    }

    fn read(&self) -> Result<String> {
        let content = fs::read_to_string(&self.file_path)
            .with_context(|| format!("Failed to read {}", self.file_path.display()))?;

        let id = content.trim();
        Uuid::parse_str(id).with_context(|| {
            format!(
                "{} does not hold a valid machine ID",
                self.file_path.display()
            )
        })?;
        Ok(id.to_string())
    }

    fn write(&self, id: &str) -> Result<()> {
        atomic_write(&self.file_path, id)
            .with_context(|| format!("Failed to write {}", self.file_path.display()))
    }
}

#[cfg(test)]
#[path = "machine_id_service_tests.rs"]
mod tests;
