use std::sync::Arc;

use anyhow::Result;
use tokio::sync::Notify;
use tokio::time::{timeout, Duration};
use tracing::{error, info, warn};

use super::Outcome;
use crate::config::update_config::FLUSH_PUBLISH_TIMEOUT_SECS;
use crate::models::{delivery_result_subject, DeliveryRef, DeliveryResult, DeliveryResultMessage};
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::{DeliveryClaim, ResultStore};

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

    pub(super) async fn claim(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
    ) -> Result<DeliveryClaim> {
        if !self.store.enabled() {
            return Ok(DeliveryClaim::Claimed);
        }
        let claim = self
            .store
            .delivery_claim(delivery_result_subject(machine_id), delivery.clone())
            .await?;
        if claim == DeliveryClaim::Resent {
            self.flush_notify.notify_one();
        }
        Ok(claim)
    }

    pub(super) async fn release(&self, delivery: &DeliveryRef) {
        if !self.store.enabled() {
            return;
        }
        if let Err(e) = self
            .store
            .delivery_release(delivery.dispatch_id.clone())
            .await
        {
            warn!(
                dispatch_id = %delivery.dispatch_id,
                "Failed to release the command, its retries are dropped until the next start: {:#}", e
            );
        }
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
        let message = DeliveryResultMessage {
            delivery: delivery.clone(),
            result: DeliveryResult::Acked,
            error: None,
        };
        let subject = delivery_result_subject(machine_id);
        let published = match serde_json::to_vec(&message) {
            Ok(bytes) => timeout(
                Duration::from_secs(FLUSH_PUBLISH_TIMEOUT_SECS),
                self.publisher.publish_raw(&subject, &bytes),
            )
            .await
            .unwrap_or_else(|_| Err(anyhow::anyhow!("publish timed out"))),
            Err(e) => Err(e.into()),
        };
        match published {
            Ok(()) => info!(dispatch_id = %delivery.dispatch_id, "Delivery ACKED"),
            Err(e) => warn!(
                dispatch_id = %delivery.dispatch_id,
                "Failed to report ACKED, the backend retry re-sends the command: {:#}", e
            ),
        }
    }

    pub(super) async fn settle(
        &self,
        machine_id: &str,
        delivery: DeliveryRef,
        outcome: Outcome,
    ) -> bool {
        let subject = delivery_result_subject(machine_id);
        let message = result_message(delivery, outcome);
        if self.store.enabled() {
            return self.queue(subject, message).await;
        }
        self.publish(&subject, &message).await
    }

    // the agent removes itself right after, so the result cannot wait for the outbox
    pub(super) async fn settle_now(
        &self,
        machine_id: &str,
        delivery: DeliveryRef,
        outcome: Outcome,
    ) -> bool {
        let subject = delivery_result_subject(machine_id);
        let message = result_message(delivery, outcome);
        if !self.publish(&subject, &message).await {
            return self.store.enabled() && self.queue(subject, message).await;
        }
        if self.store.enabled() {
            let dispatch_id = message.delivery.dispatch_id.clone();
            if let Err(e) = self.store.delivery_record(subject, message).await {
                warn!(
                    dispatch_id = %dispatch_id,
                    "Failed to keep the published result for repeats: {:#}", e
                );
            }
        }
        true
    }

    async fn queue(&self, subject: String, message: DeliveryResultMessage) -> bool {
        let dispatch_id = message.delivery.dispatch_id.clone();
        let result = message.result;
        match self.store.delivery_settle(subject, message).await {
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

    async fn publish(&self, subject: &str, message: &DeliveryResultMessage) -> bool {
        let dispatch_id = &message.delivery.dispatch_id;
        let result = message.result;
        let published = match serde_json::to_vec(message) {
            Ok(bytes) => timeout(
                Duration::from_secs(FLUSH_PUBLISH_TIMEOUT_SECS),
                self.publisher.publish_acked(subject, &bytes),
            )
            .await
            .unwrap_or_else(|_| Err(anyhow::anyhow!("publish timed out"))),
            Err(e) => Err(e.into()),
        };
        match published {
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
}

fn result_message(delivery: DeliveryRef, outcome: Outcome) -> DeliveryResultMessage {
    let (result, error) = match outcome {
        Outcome::Failed(reason) => (DeliveryResult::Failed, Some(reason)),
        Outcome::Done | Outcome::RestartRequired | Outcome::Restarting => {
            (DeliveryResult::Done, None)
        }
    };
    DeliveryResultMessage {
        delivery,
        result,
        error,
    }
}
