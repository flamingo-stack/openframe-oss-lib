use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, PoisonError};
use tracing::warn;

use crate::config::updater_config::{
    DELIVERY_LEDGER_FILE_NAME, DELIVERY_LEDGER_MAX_SETTLED, DELIVERY_LEDGER_TTL_SECS,
};
use crate::models::DeliveryResultMessage;
use crate::platform::DirectoryManager;
use crate::utils::durable_file::write_durably;

/// What the updater remembers of delivery-engine client updates: the highest
/// sequence applied, so an older rollout reaching the machine late is answered
/// done without running, and the settled results, so a repeated dispatch gets its
/// result again instead of a second run and a result survives until it is out.
#[derive(Clone)]
pub struct DeliveryLedger {
    path: PathBuf,
    lock: Arc<Mutex<()>>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LedgerFile {
    #[serde(default)]
    applied_sequence: i64,
    #[serde(default)]
    settled: Vec<SettledResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettledResult {
    message: DeliveryResultMessage,
    settled_at: DateTime<Utc>,
    published: bool,
}

impl DeliveryLedger {
    pub fn new(directory_manager: &DirectoryManager) -> Self {
        Self::at(
            directory_manager
                .secured_dir()
                .join(DELIVERY_LEDGER_FILE_NAME),
        )
    }

    pub fn at(path: PathBuf) -> Self {
        Self {
            path,
            lock: Arc::new(Mutex::new(())),
        }
    }

    pub fn applied_sequence(&self) -> i64 {
        let _guard = self.lock.lock().unwrap_or_else(PoisonError::into_inner);
        self.read().applied_sequence
    }

    pub fn record_applied(&self, sequence: i64) -> Result<()> {
        self.update(|file| file.applied_sequence = file.applied_sequence.max(sequence))
    }

    pub fn settled(&self, dispatch_id: &str) -> Option<DeliveryResultMessage> {
        let _guard = self.lock.lock().unwrap_or_else(PoisonError::into_inner);
        self.read()
            .settled
            .into_iter()
            .find(|entry| entry.message.delivery.dispatch_id == dispatch_id)
            .map(|entry| entry.message)
    }

    /// Records `message` as the final result of its dispatch, not yet published.
    pub fn settle(&self, message: DeliveryResultMessage) -> Result<()> {
        self.update(|file| {
            let dispatch_id = message.delivery.dispatch_id.clone();
            file.settled
                .retain(|entry| entry.message.delivery.dispatch_id != dispatch_id);
            file.settled.push(SettledResult {
                message,
                settled_at: Utc::now(),
                published: false,
            });
        })
    }

    pub fn mark_published(&self, dispatch_id: &str) -> Result<()> {
        self.update(|file| {
            for entry in file
                .settled
                .iter_mut()
                .filter(|entry| entry.message.delivery.dispatch_id == dispatch_id)
            {
                entry.published = true;
            }
        })
    }

    pub fn unpublished(&self) -> Vec<DeliveryResultMessage> {
        let _guard = self.lock.lock().unwrap_or_else(PoisonError::into_inner);
        self.read()
            .settled
            .into_iter()
            .filter(|entry| !entry.published)
            .map(|entry| entry.message)
            .collect()
    }

    // An unreadable ledger must not stop updates: it reads as empty and the next write replaces it.
    fn read(&self) -> LedgerFile {
        let raw = match fs::read_to_string(&self.path) {
            Ok(raw) => raw,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return LedgerFile::default(),
            Err(e) => {
                warn!("Failed to read {}: {}", self.path.display(), e);
                return LedgerFile::default();
            }
        };
        serde_json::from_str(&raw).unwrap_or_else(|e| {
            warn!("Ignoring unreadable {}: {}", self.path.display(), e);
            LedgerFile::default()
        })
    }

    fn update(&self, change: impl FnOnce(&mut LedgerFile)) -> Result<()> {
        let _guard = self.lock.lock().unwrap_or_else(PoisonError::into_inner);
        let mut file = self.read();
        change(&mut file);
        prune(&mut file, Utc::now());
        let json = serde_json::to_string_pretty(&file).context("Failed to serialize the ledger")?;
        write_durably(&self.path, json.as_bytes())
    }
}

fn prune(file: &mut LedgerFile, now: DateTime<Utc>) {
    let oldest = now - chrono::Duration::seconds(DELIVERY_LEDGER_TTL_SECS);
    file.settled.retain(|entry| entry.settled_at > oldest);
    if file.settled.len() > DELIVERY_LEDGER_MAX_SETTLED {
        let excess = file.settled.len() - DELIVERY_LEDGER_MAX_SETTLED;
        file.settled.drain(..excess);
    }
}

#[cfg(test)]
#[path = "delivery_ledger_tests.rs"]
mod tests;
