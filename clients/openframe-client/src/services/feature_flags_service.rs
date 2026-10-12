use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Mutex, PoisonError};

use anyhow::{Context, Result};
use serde_json::Value;
use tracing::{info, warn};

use crate::models::{DeliveryRef, FeatureFlags, FeatureFlagsMessage, FeatureFlagsState};
use crate::utils::fs::atomic_write;

pub struct FeatureFlagsService {
    path: PathBuf,
    running: FeatureFlags,
    state: Mutex<FeatureFlagsState>,
}

#[derive(Debug, PartialEq)]
pub enum FlagsApplied {
    Unchanged,
    RestartRequired,
}

impl FeatureFlagsService {
    pub fn load(path: PathBuf) -> Self {
        let state = match std::fs::read(&path) {
            Ok(bytes) => match serde_json::from_slice::<FeatureFlagsState>(&bytes) {
                Ok(state) => state,
                Err(e) => {
                    warn!(path = %path.display(), "Feature flags file unreadable, all features off: {:#}", e);
                    FeatureFlagsState::default()
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => FeatureFlagsState::default(),
            Err(e) => {
                warn!(path = %path.display(), "Failed to read feature flags file, all features off: {:#}", e);
                FeatureFlagsState::default()
            }
        };
        let running = FeatureFlags::from_flags(&state.flags);
        info!(sequence = state.sequence, flags = ?state.flags, "Feature flags loaded");
        Self {
            path,
            running,
            state: Mutex::new(state),
        }
    }

    pub fn flags(&self) -> &FeatureFlags {
        &self.running
    }

    pub fn applied_sequence(&self, machine_id: &str) -> i64 {
        let state = self.state.lock().unwrap_or_else(PoisonError::into_inner);
        if state.machine_id == machine_id {
            return state.sequence;
        }
        info!(
            applied_for = %state.machine_id,
            machine_id,
            "Feature flags were applied for another registration, accepting any sequence"
        );
        0
    }

    pub fn apply(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        sequence: i64,
        message: FeatureFlagsMessage,
    ) -> Result<FlagsApplied> {
        let mut flags = BTreeMap::new();
        for (name, value) in message.flags {
            match value {
                Value::Bool(enabled) => {
                    flags.insert(name, enabled);
                }
                other => {
                    warn!(flag = %name, value = %other, "Ignoring feature flag with a non-boolean value")
                }
            }
        }
        let applied = if FeatureFlags::from_flags(&flags) == self.running {
            FlagsApplied::Unchanged
        } else {
            FlagsApplied::RestartRequired
        };
        let state = FeatureFlagsState {
            machine_id: machine_id.to_string(),
            sequence,
            flags,
            awaiting_restart: (applied == FlagsApplied::RestartRequired).then(|| delivery.clone()),
        };
        self.persist(&state)?;
        info!(sequence, flags = ?state.flags, ?applied, "Feature flags persisted");
        *self.state.lock().unwrap_or_else(PoisonError::into_inner) = state;
        Ok(applied)
    }

    pub fn awaiting_restart(&self) -> Option<DeliveryRef> {
        self.state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .awaiting_restart
            .clone()
    }

    pub fn restart_reported(&self) -> Result<()> {
        let mut state = self.state.lock().unwrap_or_else(PoisonError::into_inner);
        let mut reported = state.clone();
        reported.awaiting_restart = None;
        self.persist(&reported)?;
        *state = reported;
        Ok(())
    }

    fn persist(&self, state: &FeatureFlagsState) -> Result<()> {
        atomic_write(&self.path, serde_json::to_vec_pretty(state)?)
            .with_context(|| format!("failed to persist feature flags to {}", self.path.display()))
    }
}

#[cfg(test)]
#[path = "feature_flags_service_tests.rs"]
mod tests;
