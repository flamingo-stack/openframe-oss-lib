use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UpdatePhase {
    Validating,
    Downloading,
    Extracting,
    PreparingUpdater,
    UpdaterLaunched,
    Completed,
    Verifying,
    RolledBack,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateState {
    pub target_version: String,

    /// Current phase
    pub phase: UpdatePhase,

    #[serde(default)]
    pub boot_attempts: u32,

    #[serde(default)]
    pub started_at: Option<String>,
    /// Failure reason stamped by the updater script
    #[serde(default)]
    pub last_error: Option<String>,
}

impl UpdateState {
    pub fn new(target_version: String) -> Self {
        Self {
            target_version,
            phase: UpdatePhase::Validating,
            boot_attempts: 0,
            started_at: Some(chrono::Utc::now().to_rfc3339()),
            last_error: None,
        }
    }

    pub fn set_phase(&mut self, phase: UpdatePhase) {
        self.phase = phase;
    }
}

#[cfg(test)]
#[path = "update_state_tests.rs"]
mod tests;
