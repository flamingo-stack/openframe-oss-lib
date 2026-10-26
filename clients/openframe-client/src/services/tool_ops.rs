use crate::config::update_config::CLIENT_UPDATE_POLL_SECS;
use crate::services::tool_run_manager::ClientUpdatePending;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, PoisonError};
use tokio::sync::OwnedMutexGuard;
use tokio::time::{sleep, Duration};
use tracing::info;

#[derive(Clone)]
pub struct ToolOps {
    locks: Arc<Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>>,
    state: Arc<Mutex<OpState>>,
    // the swap of a client update would cut a new operation short, so none starts while one holds the client
    client_update: ClientUpdatePending,
}

impl Default for ToolOps {
    fn default() -> Self {
        Self::new(ClientUpdatePending::never())
    }
}

#[derive(Default)]
struct OpState {
    busy: HashSet<String>,
    released: HashSet<String>,
}

#[derive(Debug)]
pub struct Busy;

#[derive(Clone)]
pub struct BusyTools(Arc<Mutex<OpState>>);

impl BusyTools {
    pub fn any(&self) -> bool {
        !self
            .0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .busy
            .is_empty()
    }
}

pub struct ToolLock {
    ops: ToolOps,
    tool_agent_id: String,
    lock: OwnedMutexGuard<()>,
}

/// Clears the updating flag on drop, releasing the tool lock only once the flag is clear.
pub struct ToolOpGuard {
    ops: ToolOps,
    tool_agent_id: String,
    _lock: OwnedMutexGuard<()>,
}

impl ToolOps {
    pub fn new(client_update: ClientUpdatePending) -> Self {
        Self {
            locks: Arc::default(),
            state: Arc::default(),
            client_update,
        }
    }

    /// Waits out a client update holding the client, then for the tool lock.
    pub async fn lock(&self, tool_agent_id: &str) -> ToolLock {
        while self.client_update.is_pending() {
            sleep(Duration::from_secs(CLIENT_UPDATE_POLL_SECS)).await;
        }
        let lock = self.lock_for(tool_agent_id).lock_owned().await;
        self.tool_lock(tool_agent_id, lock)
    }

    /// Busy while another operation holds the tool or a client update holds the client.
    pub fn try_lock(&self, tool_agent_id: &str) -> Result<ToolLock, Busy> {
        if self.client_update.is_pending() {
            return Err(Busy);
        }
        let lock = self
            .lock_for(tool_agent_id)
            .try_lock_owned()
            .map_err(|_| Busy)?;
        Ok(self.tool_lock(tool_agent_id, lock))
    }

    pub fn is_busy(&self, tool_agent_id: &str) -> bool {
        self.state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .busy
            .contains(tool_agent_id)
    }

    pub fn any_busy(&self) -> bool {
        self.busy_tools().any()
    }

    pub fn busy_tools(&self) -> BusyTools {
        BusyTools(self.state.clone())
    }

    pub(crate) fn is_released(&self, tool_agent_id: &str) -> bool {
        self.state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .released
            .contains(tool_agent_id)
    }

    pub(crate) fn take_released(&self, tool_agent_id: &str) -> bool {
        self.state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .released
            .remove(tool_agent_id)
    }

    fn lock_for(&self, tool_agent_id: &str) -> Arc<tokio::sync::Mutex<()>> {
        self.locks
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .entry(tool_agent_id.to_string())
            .or_default()
            .clone()
    }

    fn tool_lock(&self, tool_agent_id: &str, lock: OwnedMutexGuard<()>) -> ToolLock {
        ToolLock {
            ops: self.clone(),
            tool_agent_id: tool_agent_id.to_string(),
            lock,
        }
    }
}

impl ToolLock {
    pub fn mark_busy(self) -> ToolOpGuard {
        self.ops
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .busy
            .insert(self.tool_agent_id.clone());
        info!("Tool {} marked as updating", self.tool_agent_id);
        ToolOpGuard {
            ops: self.ops,
            tool_agent_id: self.tool_agent_id,
            _lock: self.lock,
        }
    }
}

impl From<ToolLock> for ToolOpGuard {
    fn from(lock: ToolLock) -> Self {
        lock.mark_busy()
    }
}

impl Drop for ToolOpGuard {
    fn drop(&mut self) {
        let mut state = self
            .ops
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        state.busy.remove(&self.tool_agent_id);
        // A run loop parked on a restart delay relaunches now instead of waiting it out.
        state.released.insert(self.tool_agent_id.clone());
        drop(state);
        info!("Tool {} update flag cleared", self.tool_agent_id);
    }
}

#[cfg(test)]
#[path = "tool_ops_tests.rs"]
mod tests;
