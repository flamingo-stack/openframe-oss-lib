use std::sync::Arc;

use tokio::sync::Notify;
use tokio::time::{timeout, Duration};
use tracing::{error, info, warn};

use super::Outcome;
use crate::config::update_config::FLUSH_PUBLISH_TIMEOUT_SECS;
use crate::models::{delivery_result_subject, DeliveryRef, DeliveryResult, DeliveryResultMessage};
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::ResultStore;

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
        let dispatch_id = delivery.dispatch_id.clone();
        let (result, error) = match outcome {
            Outcome::Done | Outcome::RestartRequired => (DeliveryResult::Done, None),
            Outcome::Failed(reason) => (DeliveryResult::Failed, Some(reason)),
        };
        let message = DeliveryResultMessage {
            delivery,
            result,
            error,
        };
        let subject = delivery_result_subject(machine_id);

        if self.store.enabled() {
            let enqueued = match serde_json::to_vec(&message) {
                Ok(bytes) => {
                    self.store
                        .enqueue(format!("delivery:{}", dispatch_id), subject, bytes)
                        .await
                }
                Err(e) => Err(e.into()),
            };
            return match enqueued {
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
            };
        }

        let published = match serde_json::to_vec(&message) {
            Ok(bytes) => timeout(
                Duration::from_secs(FLUSH_PUBLISH_TIMEOUT_SECS),
                self.publisher.publish_acked(&subject, &bytes),
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
                    "Failed to publish delivery result without a durable store, the backend closes it on timeout: {:#}", e
                );
                false
            }
        }
    }
}
