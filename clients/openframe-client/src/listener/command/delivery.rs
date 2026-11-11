use std::collections::HashSet;
use std::sync::Arc;

use anyhow::Result;
use tokio::sync::Notify;
use tracing::{error, info, warn};

use crate::models::{delivery_result_subject, DeliveryRef, DeliveryResultMessage};
use crate::services::delivery_results::DeliveryResults;
use crate::services::result_store::{LedgerState, ResultStore};

#[derive(Clone)]
pub(super) struct Delivery {
    results: DeliveryResults,
    store: Arc<ResultStore>,
    flush_notify: Arc<Notify>,
}

impl Delivery {
    pub(super) fn new(
        results: DeliveryResults,
        store: Arc<ResultStore>,
        flush_notify: Arc<Notify>,
    ) -> Self {
        Self {
            results,
            store,
            flush_notify,
        }
    }

    pub(super) async fn recover(&self) {
        match self.store.recover_deliveries().await {
            Ok(0) => {}
            Ok(_) => self.flush_notify.notify_one(),
            Err(e) => error!("Failed to recover interrupted commands: {:#}", e),
        }
    }

    pub(super) async fn fail_orphaned(&self, delivery_type: &str, owned: HashSet<String>) {
        match self
            .store
            .delivery_settle_orphaned(delivery_type.to_string(), owned)
            .await
        {
            Ok(orphaned) if orphaned.is_empty() => {}
            Ok(orphaned) => {
                self.flush_notify.notify_one();
                info!(
                    delivery_type,
                    count = orphaned.len(),
                    "Reported commands whose work the agent lost as failed"
                );
            }
            Err(e) => error!(
                delivery_type,
                "Failed to report commands whose work the agent lost: {:#}", e
            ),
        }
    }

    pub(super) async fn state(&self, delivery: &DeliveryRef) -> Result<Option<LedgerState>> {
        if !self.store.enabled() {
            return Ok(None);
        }
        self.store
            .delivery_state(delivery.dispatch_id.clone())
            .await
    }

    pub(super) async fn accept(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        state: LedgerState,
    ) -> Result<()> {
        if !self.store.enabled() {
            return Ok(());
        }
        self.store
            .delivery_accept(delivery_result_subject(machine_id), delivery.clone(), state)
            .await
    }

    pub(super) async fn await_restart(&self, delivery: &DeliveryRef) {
        if !self.store.enabled() {
            return;
        }
        if let Err(e) = self
            .store
            .delivery_await_restart(delivery.dispatch_id.clone())
            .await
        {
            warn!(
                dispatch_id = %delivery.dispatch_id,
                "Failed to mark the command as settled after the restart, the restart reports it failed: {:#}", e
            );
        }
    }

    pub(super) async fn defer(&self, delivery: &DeliveryRef) {
        if !self.store.enabled() {
            return;
        }
        if let Err(e) = self
            .store
            .delivery_defer(delivery.dispatch_id.clone())
            .await
        {
            warn!(
                dispatch_id = %delivery.dispatch_id,
                "Failed to mark the command as answered later, a restart reports it failed: {:#}", e
            );
        }
    }

    // the applied sequence when this one is at or below it
    pub(super) async fn stale(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        floor: i64,
    ) -> Option<i64> {
        let sequence = delivery.sequence?;
        let stored = if self.store.enabled() {
            match self.store.applied_sequence(delivery, machine_id).await {
                Ok(applied) => applied,
                Err(e) => {
                    warn!(
                        dispatch_id = %delivery.dispatch_id,
                        "Failed to read the applied sequence: {:#}", e
                    );
                    0
                }
            }
        } else {
            0
        };
        let applied = stored.max(floor);
        (sequence <= applied).then_some(applied)
    }

    pub(super) async fn record_applied(&self, machine_id: &str, delivery: &DeliveryRef) {
        let Some(sequence) = delivery.sequence else {
            return;
        };
        if !self.store.enabled() {
            return;
        }
        if let Err(e) = self
            .store
            .record_applied_sequence(delivery, machine_id, sequence)
            .await
        {
            warn!(
                dispatch_id = %delivery.dispatch_id,
                sequence,
                "Failed to record the applied sequence: {:#}", e
            );
        }
    }

    pub(super) async fn acked(&self, machine_id: &str, delivery: &DeliveryRef) {
        let message = DeliveryResultMessage::acked(delivery.clone());
        match self.results.send(machine_id, &message).await {
            Ok(()) => info!(dispatch_id = %delivery.dispatch_id, "Delivery ACKED"),
            Err(e) => warn!(
                dispatch_id = %delivery.dispatch_id,
                "Failed to report ACKED, the backend retry re-sends the command: {:#}", e
            ),
        }
    }

    pub(super) async fn settle(&self, machine_id: &str, message: DeliveryResultMessage) -> bool {
        self.results.settle(machine_id, message).await
    }

    // the agent removes itself right after, so the result cannot wait for the outbox
    pub(super) async fn settle_now(
        &self,
        machine_id: &str,
        message: DeliveryResultMessage,
    ) -> bool {
        self.results.settle_now(machine_id, message).await
    }
}
