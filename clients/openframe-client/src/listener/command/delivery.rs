use std::sync::Arc;

use anyhow::Result;
use tokio::sync::Notify;
use tokio::time::{timeout, Duration};
use tracing::{error, info, warn};

use crate::config::update_config::FLUSH_PUBLISH_TIMEOUT_SECS;
use crate::models::{delivery_result_subject, DeliveryRef, DeliveryResult, DeliveryResultMessage};
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::{LedgerState, ResultStore};

#[derive(Clone)]
pub(super) struct Delivery {
    publisher: NatsMessagePublisher,
    store: Arc<ResultStore>,
    flush_notify: Arc<Notify>,
}

impl Delivery {
    pub(super) fn new(
        publisher: NatsMessagePublisher,
        store: Arc<ResultStore>,
        flush_notify: Arc<Notify>,
    ) -> Self {
        Self {
            publisher,
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
        match self.send(machine_id, &message).await {
            Ok(()) => info!(dispatch_id = %delivery.dispatch_id, "Delivery ACKED"),
            Err(e) => warn!(
                dispatch_id = %delivery.dispatch_id,
                "Failed to report ACKED, the backend retry re-sends the command: {:#}", e
            ),
        }
    }

    pub(super) async fn settle(&self, machine_id: &str, message: DeliveryResultMessage) -> bool {
        if self.store.enabled() {
            return self.queue(machine_id, message).await;
        }
        self.publish(machine_id, &message).await
    }

    // the agent removes itself right after, so the result cannot wait for the outbox
    pub(super) async fn settle_now(
        &self,
        machine_id: &str,
        message: DeliveryResultMessage,
    ) -> bool {
        if !self.publish(machine_id, &message).await {
            return self.store.enabled() && self.queue(machine_id, message).await;
        }
        if self.store.enabled() {
            let dispatch_id = message.delivery.dispatch_id.clone();
            if let Err(e) = self
                .store
                .delivery_record(delivery_result_subject(machine_id), message)
                .await
            {
                warn!(
                    dispatch_id = %dispatch_id,
                    "Failed to keep the published result for repeats: {:#}", e
                );
            }
        }
        true
    }

    async fn queue(&self, machine_id: &str, message: DeliveryResultMessage) -> bool {
        let dispatch_id = message.delivery.dispatch_id.clone();
        let result = message.result;
        match self
            .store
            .delivery_settle(delivery_result_subject(machine_id), message)
            .await
        {
            Ok(()) => {
                self.flush_notify.notify_one();
                info!(dispatch_id = %dispatch_id, ?result, "Delivery result queued");
                true
            }
            Err(e) => {
                error!(
                    dispatch_id = %dispatch_id,
                    ?result,
                    "Failed to persist delivery result, the backend closes it on timeout: {:#}", e
                );
                false
            }
        }
    }

    async fn publish(&self, machine_id: &str, message: &DeliveryResultMessage) -> bool {
        let dispatch_id = &message.delivery.dispatch_id;
        let result = message.result;
        match self.send(machine_id, message).await {
            Ok(()) => {
                info!(dispatch_id = %dispatch_id, ?result, "Delivery result published");
                true
            }
            Err(e) => {
                error!(
                    dispatch_id = %dispatch_id,
                    ?result,
                    "Failed to publish delivery result: {:#}", e
                );
                false
            }
        }
    }

    // ACKED goes out best effort, a result only once its stream stored it
    async fn send(&self, machine_id: &str, message: &DeliveryResultMessage) -> Result<()> {
        let subject = delivery_result_subject(machine_id);
        let bytes = serde_json::to_vec(message)?;
        let send = async {
            if message.result == DeliveryResult::Acked {
                self.publisher.publish_raw(&subject, &bytes).await
            } else {
                self.publisher.publish_acked(&subject, &bytes).await
            }
        };
        timeout(Duration::from_secs(FLUSH_PUBLISH_TIMEOUT_SECS), send)
            .await
            .unwrap_or_else(|_| Err(anyhow::anyhow!("publish timed out")))
    }
}
