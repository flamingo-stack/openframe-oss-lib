use std::path::PathBuf;
use std::sync::{Mutex, PoisonError};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tokio::sync::Notify;
use tracing::{info, warn};

use crate::models::PolicyEntry;
use crate::utils::fs::atomic_write;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
struct PackagePolicyState {
    #[serde(default)]
    machine_id: String,
    sequence: i64,
    packages: Vec<PolicyEntry>,
}

/// The backend's desired set of auto-updated packages, as last delivered. Replaced wholesale;
/// readers learn about a change through [`PolicyStore::changed`].
pub struct PolicyStore {
    path: PathBuf,
    state: Mutex<PackagePolicyState>,
    changed: Notify,
}

impl PolicyStore {
    pub fn load(path: PathBuf) -> Self {
        let state = match std::fs::read(&path) {
            Ok(bytes) => match serde_json::from_slice::<PackagePolicyState>(&bytes) {
                Ok(state) => state,
                Err(e) => {
                    warn!(path = %path.display(), "Package policy file unreadable, auto-update off until the next delivery: {:#}", e);
                    PackagePolicyState::default()
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => PackagePolicyState::default(),
            Err(e) => {
                warn!(path = %path.display(), "Failed to read package policy file, auto-update off until the next delivery: {:#}", e);
                PackagePolicyState::default()
            }
        };
        info!(
            sequence = state.sequence,
            packages = state.packages.len(),
            "Package policy loaded"
        );
        Self {
            path,
            state: Mutex::new(state),
            changed: Notify::new(),
        }
    }

    /// The sequence of the policy applied for `machine_id`; 0 when it was applied for another one.
    pub fn applied_sequence(&self, machine_id: &str) -> i64 {
        let state = self.state();
        if state.machine_id == machine_id {
            state.sequence
        } else {
            0
        }
    }

    pub fn apply(&self, machine_id: &str, sequence: i64, packages: Vec<PolicyEntry>) -> Result<()> {
        let next = PackagePolicyState {
            machine_id: machine_id.to_string(),
            sequence,
            packages,
        };
        atomic_write(&self.path, serde_json::to_vec_pretty(&next)?).with_context(|| {
            format!(
                "failed to persist package policy to {}",
                self.path.display()
            )
        })?;

        let mut state = self.state();
        let changed = state.packages != next.packages;
        info!(
            sequence,
            packages = next.packages.len(),
            changed,
            "Package policy applied"
        );
        *state = next;
        drop(state);
        if changed {
            self.changed.notify_one();
        }
        Ok(())
    }

    pub fn entries(&self) -> Vec<PolicyEntry> {
        self.state().packages.clone()
    }

    /// Resolves once the package set has changed since the last call; a change made while nobody
    /// waits is not lost.
    pub async fn changed(&self) {
        self.changed.notified().await;
    }

    fn state(&self) -> std::sync::MutexGuard<'_, PackagePolicyState> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

#[cfg(test)]
#[path = "policy_tests.rs"]
mod tests;
