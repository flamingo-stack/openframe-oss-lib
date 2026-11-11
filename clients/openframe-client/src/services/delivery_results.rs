use std::sync::Arc;

use anyhow::Result;
use tokio::sync::Notify;
use tokio::time::{timeout, Duration};
use tracing::{error, info, warn};

use crate::config::update_config::FLUSH_PUBLISH_TIMEOUT_SECS;
use crate::models::{delivery_result_subject, DeliveryResult, DeliveryResultMessage};
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::ResultStore;

#[derive(Clone)]
pub struct DeliveryResults {
    sink: Sink,
}

#[derive(Clone)]
enum Sink {
    Outbox(Arc<Outbox>),
    #[cfg(test)]
    Memory(Arc<std::sync::Mutex<Vec<DeliveryResultMessage>>>),
}

struct Outbox {
    publisher: NatsMessagePublisher,
    store: Arc<ResultStore>,
    flush: Arc<Notify>,
}

impl DeliveryResults {
    pub fn new(
        publisher: NatsMessagePublisher,
        store: Arc<ResultStore>,
        flush: Arc<Notify>,
    ) -> Self {
        Self {
            sink: Sink::Outbox(Arc::new(Outbox {
                publisher,
                store,
                flush,
            })),
        }
    }

    #[cfg(test)]
    pub(crate) fn in_memory() -> (Self, Arc<std::sync::Mutex<Vec<DeliveryResultMessage>>>) {
        let results = Arc::new(std::sync::Mutex::new(Vec::new()));
        (
            Self {
                sink: Sink::Memory(results.clone()),
            },
            results,
        )
    }

    pub async fn settle(&self, machine_id: &str, message: DeliveryResultMessage) -> bool {
        match &self.sink {
            Sink::Outbox(outbox) => {
                if outbox.store.enabled() {
                    return outbox.queue(machine_id, message).await;
                }
                outbox.publish(machine_id, &message).await
            }
            #[cfg(test)]
            Sink::Memory(results) => {
                results
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner)
                    .push(message);
                true
            }
        }
    }

    // the agent removes itself right after, so the result cannot wait for the outbox
    pub(crate) async fn settle_now(
        &self,
        machine_id: &str,
        message: DeliveryResultMessage,
    ) -> bool {
        match &self.sink {
            Sink::Outbox(outbox) => {
                if !outbox.publish(machine_id, &message).await {
                    return outbox.store.enabled() && outbox.queue(machine_id, message).await;
                }
                if outbox.store.enabled() {
                    let dispatch_id = message.delivery.dispatch_id.clone();
                    if let Err(e) = outbox
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
            #[cfg(test)]
            Sink::Memory(_) => self.settle(machine_id, message).await,
        }
    }

    pub(crate) async fn send(
        &self,
        machine_id: &str,
        message: &DeliveryResultMessage,
    ) -> Result<()> {
        match &self.sink {
            Sink::Outbox(outbox) => outbox.send(machine_id, message).await,
            #[cfg(test)]
            Sink::Memory(results) => {
                results
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner)
                    .push(message.clone());
                Ok(())
            }
        }
    }
}

impl Outbox {
    async fn queue(&self, machine_id: &str, message: DeliveryResultMessage) -> bool {
        let dispatch_id = message.delivery.dispatch_id.clone();
        let result = message.result;
        match self
            .store
            .delivery_settle(delivery_result_subject(machine_id), message)
            .await
        {
            Ok(()) => {
                self.flush.notify_one();
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
