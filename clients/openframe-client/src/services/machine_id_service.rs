use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::platform::DirectoryManager;
use crate::utils::fs::atomic_write;

pub const MACHINE_ID_HEADER: &str = "x-machine-id";

// Locally generated machine identity, distinct from the server-assigned machine_id in agent config.
// Persisted in the shared app-support dir so integrated tool agents (mesh, fleet) can read it.
#[derive(Clone)]
pub struct MachineIdService {
    file_path: PathBuf,
    cached_id: Arc<std::sync::RwLock<Option<String>>>,
}

impl MachineIdService {
    pub fn new(directory_manager: &DirectoryManager) -> Self {
        Self {
            file_path: directory_manager.app_support_dir().join("machine_id"),
            cached_id: Arc::new(std::sync::RwLock::new(None)),
        }
    }

    pub fn get_or_create(&self) -> Result<String> {
        if let Some(id) = self.cached_id.read().unwrap().clone() {
            return Ok(id);
        }

        match self.read() {
            Ok(id) => {
                debug!("Using existing machine ID: {}", id);
                *self.cached_id.write().unwrap() = Some(id.clone());
                return Ok(id);
            }
            Err(e) if self.file_path.exists() => {
                warn!("{:#}; generating a new machine ID", e);
            }
            Err(_) => {}
        }

        let id = Uuid::new_v4().to_string();
        self.write(&id)?;
        info!("Generated new machine ID: {}", id);
        *self.cached_id.write().unwrap() = Some(id.clone());
        Ok(id)
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
