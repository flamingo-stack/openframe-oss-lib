use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, PoisonError};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tokio::sync::Notify;
use tracing::{info, warn};

use crate::models::{PackageRef, PackageUpdateMessage, SourceKind, UpdateMode, UpdateSource};
use crate::utils::fs::atomic_write;

/// Finished requests remembered for the stale-sequence rule.
const FINISHED_MEMORY: usize = 100;

/// One accepted order as persisted: what to do, not how far it got.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Order {
    pub request_id: String,
    pub sequence: i64,
    pub source: UpdateSource,
    pub package: PackageRef,
    pub mode: UpdateMode,
    pub countdown_seconds: u64,
    pub received_at: u64,
    /// Bumped on every re-send, so a waiting order reports its state again.
    #[serde(default)]
    pub revision: u64,
}

impl Order {
    fn priority(&self) -> (u8, u64, &str) {
        let class = match self.source.kind {
            SourceKind::Manual => 0,
            SourceKind::Auto => 1,
        };
        (class, self.received_at, &self.request_id)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct Finished {
    request_id: String,
    sequence: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
struct Orders {
    #[serde(default)]
    machine_id: String,
    #[serde(default)]
    pending: Vec<Order>,
    #[serde(default)]
    finished: Vec<Finished>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Submitted {
    /// A new request, or a known one with a new mode or countdown.
    Accepted,
    /// A sequence the agent already applied for this request.
    Stale,
    /// Accepted; the pending order for the same package was replaced by it.
    Superseded(Order),
}

/// The pending update orders, persisted so they survive a restart; the worker learns about a
/// change through [`OrderStore::changed`].
pub struct OrderStore {
    path: PathBuf,
    state: Mutex<Orders>,
    changed: Notify,
}

impl OrderStore {
    pub fn load(path: PathBuf) -> Self {
        let state = match std::fs::read(&path) {
            Ok(bytes) => serde_json::from_slice::<Orders>(&bytes).unwrap_or_else(|e| {
                warn!(path = %path.display(), "Package update orders unreadable, starting empty: {:#}", e);
                Orders::default()
            }),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Orders::default(),
            Err(e) => {
                warn!(path = %path.display(), "Failed to read package update orders, starting empty: {:#}", e);
                Orders::default()
            }
        };
        info!(
            pending = state.pending.len(),
            "Package update orders loaded"
        );
        Self {
            path,
            state: Mutex::new(state),
            changed: Notify::new(),
        }
    }

    /// Takes an order in; `countdown_seconds` is the resolved countdown for a FORCE order.
    pub fn submit(
        &self,
        machine_id: &str,
        sequence: i64,
        received_at: u64,
        message: PackageUpdateMessage,
        countdown_seconds: u64,
    ) -> Result<Submitted> {
        let mut state = self.state();
        let mut next = state.clone();
        if next.machine_id != machine_id {
            if !next.machine_id.is_empty() {
                info!("Machine id changed, dropping the orders of the previous one");
            }
            next = Orders {
                machine_id: machine_id.to_string(),
                ..Orders::default()
            };
        }

        let known = next
            .pending
            .iter()
            .find(|order| order.request_id == message.request_id)
            .map(|order| order.sequence)
            .or_else(|| {
                next.finished
                    .iter()
                    .find(|f| f.request_id == message.request_id)
                    .map(|f| f.sequence)
            });
        if known.is_some_and(|applied| sequence <= applied) {
            return Ok(Submitted::Stale);
        }

        let superseded = match next
            .pending
            .iter_mut()
            .find(|order| order.request_id == message.request_id)
        {
            Some(order) => {
                order.sequence = sequence;
                order.source = message.source;
                order.package = message.package;
                order.mode = message.mode;
                order.countdown_seconds = countdown_seconds;
                order.revision += 1;
                None
            }
            None => {
                let replaced = next
                    .pending
                    .iter()
                    .position(|order| order.package == message.package)
                    .map(|index| next.pending.remove(index));
                next.pending.push(Order {
                    request_id: message.request_id,
                    sequence,
                    source: message.source,
                    package: message.package,
                    mode: message.mode,
                    countdown_seconds,
                    received_at,
                    revision: 0,
                });
                replaced
            }
        };

        self.persist(&next)?;
        *state = next;
        drop(state);
        self.changed.notify_one();
        Ok(match superseded {
            Some(order) => Submitted::Superseded(order),
            None => Submitted::Accepted,
        })
    }

    /// Pending orders, most urgent first: manual before automatic, then oldest first.
    pub fn pending(&self) -> Vec<Order> {
        let mut pending = self.state().pending.clone();
        pending.sort_by(|a, b| a.priority().cmp(&b.priority()));
        pending
    }

    pub fn get(&self, request_id: &str) -> Option<Order> {
        self.state()
            .pending
            .iter()
            .find(|order| order.request_id == request_id)
            .cloned()
    }

    /// Drops a finished request and remembers its sequence, so a late re-send is stale.
    pub fn finish(&self, request_id: &str, sequence: i64) -> Result<()> {
        let mut state = self.state();
        let mut next = state.clone();
        next.pending.retain(|order| order.request_id != request_id);
        next.finished.retain(|f| f.request_id != request_id);
        next.finished.push(Finished {
            request_id: request_id.to_string(),
            sequence,
        });
        if next.finished.len() > FINISHED_MEMORY {
            let excess = next.finished.len() - FINISHED_MEMORY;
            next.finished.drain(..excess);
        }
        self.persist(&next)?;
        *state = next;
        drop(state);
        self.changed.notify_one();
        Ok(())
    }

    /// Resolves once the orders have changed since the last call; a change made while nobody
    /// waits is not lost.
    pub async fn changed(&self) {
        self.changed.notified().await;
    }

    fn persist(&self, orders: &Orders) -> Result<()> {
        atomic_write(&self.path, serde_json::to_vec_pretty(orders)?).with_context(|| {
            format!(
                "failed to persist package update orders to {}",
                self.path.display()
            )
        })
    }

    fn state(&self) -> MutexGuard<'_, Orders> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

#[cfg(test)]
#[path = "orders_tests.rs"]
mod tests;
