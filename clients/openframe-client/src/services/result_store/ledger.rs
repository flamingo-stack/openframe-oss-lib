use anyhow::Result;
use redb::{ReadableTable, TableDefinition, WriteTransaction};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use super::{now_secs, write_outbox_entry, ResultStore};
use crate::config::update_config::DELIVERY_LEDGER_TTL_SECS;
use crate::models::{DeliveryRef, DeliveryResult, DeliveryResultMessage};

pub(super) const DELIVERY_LEDGER: TableDefinition<&str, &[u8]> =
    TableDefinition::new("delivery_ledger");
pub(super) const DELIVERY_SEQUENCE: TableDefinition<&str, &[u8]> =
    TableDefinition::new("delivery_sequence");

const ERROR_DELIVERY_INTERRUPTED: &str = "interrupted by agent restart";

#[derive(Debug, Serialize, Deserialize)]
struct LedgerRecord {
    subject: String,
    delivery: DeliveryRef,
    state: LedgerState,
    updated_at_secs: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LedgerState {
    InFlight,
    AwaitingRestart,
    Settled(DeliveryResultMessage),
}

#[derive(Debug, Serialize, Deserialize)]
struct AppliedSequence {
    machine_id: String,
    sequence: i64,
}

impl ResultStore {
    pub async fn recover_deliveries(&self) -> Result<usize> {
        if !self.enabled() {
            return Ok(0);
        }
        let interrupted = self
            .settle_ledger(
                |record| matches!(record.state, LedgerState::InFlight),
                DeliveryResult::Failed,
                Some(ERROR_DELIVERY_INTERRUPTED.to_string()),
            )
            .await?
            .len();
        if interrupted > 0 {
            info!(
                interrupted,
                "Reported commands interrupted by the restart as failed"
            );
        }
        Ok(interrupted)
    }

    pub async fn delivery_state(&self, dispatch_id: String) -> Result<Option<LedgerState>> {
        self.with_db(move |db| {
            let txn = db.begin_read()?;
            let ledger = txn.open_table(DELIVERY_LEDGER)?;
            Ok(read_ledger(&ledger, &dispatch_id)?.map(|record| record.state))
        })
        .await
    }

    pub async fn delivery_accept(
        &self,
        subject: String,
        delivery: DeliveryRef,
        state: LedgerState,
    ) -> Result<()> {
        self.with_db(move |db| {
            let txn = db.begin_write()?;
            {
                let record = LedgerRecord {
                    subject,
                    delivery,
                    state,
                    updated_at_secs: now_secs(),
                };
                write_ledger(&mut txn.open_table(DELIVERY_LEDGER)?, &record)?;
            }
            txn.commit()?;
            Ok(())
        })
        .await
    }

    pub async fn delivery_await_restart(&self, dispatch_id: String) -> Result<()> {
        self.with_db(move |db| {
            let txn = db.begin_write()?;
            {
                let mut ledger = txn.open_table(DELIVERY_LEDGER)?;
                if let Some(mut record) = read_ledger(&ledger, &dispatch_id)? {
                    if matches!(record.state, LedgerState::InFlight) {
                        record.state = LedgerState::AwaitingRestart;
                        record.updated_at_secs = now_secs();
                        write_ledger(&mut ledger, &record)?;
                    }
                }
            }
            txn.commit()?;
            Ok(())
        })
        .await
    }

    pub async fn delivery_settle(
        &self,
        subject: String,
        message: DeliveryResultMessage,
    ) -> Result<()> {
        self.store_settled(subject, message, true).await?;
        self.prune_over_cap().await;
        Ok(())
    }

    // for a result already published directly: kept for repeats, never queued
    pub async fn delivery_record(
        &self,
        subject: String,
        message: DeliveryResultMessage,
    ) -> Result<()> {
        self.store_settled(subject, message, false).await
    }

    pub async fn delivery_settle_awaiting_restart(
        &self,
        delivery_type: String,
        result: DeliveryResult,
        error: Option<String>,
    ) -> Result<Vec<DeliveryRef>> {
        if !self.enabled() {
            return Ok(Vec::new());
        }
        self.settle_ledger(
            move |record| {
                matches!(record.state, LedgerState::AwaitingRestart)
                    && record.delivery.delivery_type == delivery_type
            },
            result,
            error,
        )
        .await
    }

    // 0 when nothing was applied for this registration, so any sequence is accepted
    pub async fn applied_sequence(&self, delivery: &DeliveryRef, machine_id: &str) -> Result<i64> {
        let key = sequence_key(delivery);
        let machine_id = machine_id.to_string();
        self.with_db(move |db| {
            let txn = db.begin_read()?;
            let sequences = txn.open_table(DELIVERY_SEQUENCE)?;
            let applied = read_sequence(&sequences, &key)?;
            Ok(applied
                .filter(|applied| applied.machine_id == machine_id)
                .map_or(0, |applied| applied.sequence))
        })
        .await
    }

    pub async fn record_applied_sequence(
        &self,
        delivery: &DeliveryRef,
        machine_id: &str,
        sequence: i64,
    ) -> Result<()> {
        let key = sequence_key(delivery);
        let machine_id = machine_id.to_string();
        self.with_db(move |db| {
            let txn = db.begin_write()?;
            {
                let mut sequences = txn.open_table(DELIVERY_SEQUENCE)?;
                let newer = read_sequence(&sequences, &key)?.is_some_and(|applied| {
                    applied.machine_id == machine_id && applied.sequence >= sequence
                });
                if !newer {
                    let applied = AppliedSequence {
                        machine_id,
                        sequence,
                    };
                    sequences.insert(key.as_str(), serde_json::to_vec(&applied)?.as_slice())?;
                }
            }
            txn.commit()?;
            Ok(())
        })
        .await
    }

    async fn store_settled(
        &self,
        subject: String,
        message: DeliveryResultMessage,
        queue: bool,
    ) -> Result<()> {
        self.with_db(move |db| {
            let txn = db.begin_write()?;
            {
                let mut ledger = txn.open_table(DELIVERY_LEDGER)?;
                prune_expired_ledger(&mut ledger)?;
                if queue {
                    write_settled_result(&txn, subject.clone(), &message)?;
                }
                let record = LedgerRecord {
                    subject,
                    delivery: message.delivery.clone(),
                    state: LedgerState::Settled(message),
                    updated_at_secs: now_secs(),
                };
                write_ledger(&mut ledger, &record)?;
            }
            txn.commit()?;
            Ok(())
        })
        .await
    }

    async fn settle_ledger<F>(
        &self,
        select: F,
        result: DeliveryResult,
        error: Option<String>,
    ) -> Result<Vec<DeliveryRef>>
    where
        F: Fn(&LedgerRecord) -> bool + Send + 'static,
    {
        let settled = self
            .with_db(move |db| {
                let txn = db.begin_write()?;
                let mut settled = Vec::new();
                {
                    let mut ledger = txn.open_table(DELIVERY_LEDGER)?;
                    prune_expired_ledger(&mut ledger)?;
                    let mut selected = Vec::new();
                    for entry in ledger.iter()? {
                        let (key, value) = entry?;
                        if let Some(record) = decode_ledger(key.value(), value.value()) {
                            if select(&record) {
                                selected.push(record);
                            }
                        }
                    }
                    for mut record in selected {
                        settled.push(record.delivery.clone());
                        let message = DeliveryResultMessage::new(
                            record.delivery.clone(),
                            result,
                            error.clone(),
                        );
                        write_settled_result(&txn, record.subject.clone(), &message)?;
                        record.state = LedgerState::Settled(message);
                        record.updated_at_secs = now_secs();
                        write_ledger(&mut ledger, &record)?;
                    }
                }
                txn.commit()?;
                Ok(settled)
            })
            .await?;
        if !settled.is_empty() {
            self.prune_over_cap().await;
        }
        Ok(settled)
    }
}

fn delivery_outbox_key(dispatch_id: &str) -> String {
    format!("delivery:{}", dispatch_id)
}

fn write_settled_result(
    txn: &WriteTransaction,
    subject: String,
    message: &DeliveryResultMessage,
) -> Result<()> {
    write_outbox_entry(
        txn,
        &delivery_outbox_key(&message.delivery.dispatch_id),
        subject,
        &serde_json::to_vec(message)?,
    )
}

// a row this version cannot read (written by a newer one before a rollback) counts as absent
fn decode_ledger(dispatch_id: &str, bytes: &[u8]) -> Option<LedgerRecord> {
    match serde_json::from_slice(bytes) {
        Ok(record) => Some(record),
        Err(e) => {
            warn!(dispatch_id, error = %e, "Unreadable delivery ledger entry, ignoring it");
            None
        }
    }
}

fn read_ledger(
    ledger: &impl ReadableTable<&'static str, &'static [u8]>,
    dispatch_id: &str,
) -> Result<Option<LedgerRecord>> {
    Ok(ledger
        .get(dispatch_id)?
        .and_then(|value| decode_ledger(dispatch_id, value.value())))
}

fn write_ledger(
    ledger: &mut redb::Table<&'static str, &'static [u8]>,
    record: &LedgerRecord,
) -> Result<()> {
    ledger.insert(
        record.delivery.dispatch_id.as_str(),
        serde_json::to_vec(record)?.as_slice(),
    )?;
    Ok(())
}

// an entry still in flight is left to the restart recovery
fn prune_expired_ledger(ledger: &mut redb::Table<&'static str, &'static [u8]>) -> Result<()> {
    let now = now_secs();
    let mut expired = Vec::new();
    for entry in ledger.iter()? {
        let (key, value) = entry?;
        let expired_or_unreadable =
            decode_ledger(key.value(), value.value()).is_none_or(|record| {
                !matches!(record.state, LedgerState::InFlight)
                    && now.saturating_sub(record.updated_at_secs) > DELIVERY_LEDGER_TTL_SECS
            });
        if expired_or_unreadable {
            expired.push(key.value().to_string());
        }
    }
    for key in expired {
        ledger.remove(key.as_str())?;
    }
    Ok(())
}

fn sequence_key(delivery: &DeliveryRef) -> String {
    format!("{}:{}", delivery.delivery_type, delivery.target_id)
}

fn read_sequence(
    sequences: &impl ReadableTable<&'static str, &'static [u8]>,
    key: &str,
) -> Result<Option<AppliedSequence>> {
    Ok(sequences
        .get(key)?
        .and_then(|value| serde_json::from_slice(value.value()).ok()))
}

#[cfg(test)]
#[path = "ledger_tests.rs"]
mod tests;
