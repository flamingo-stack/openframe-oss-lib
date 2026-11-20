use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use tokio::sync::Notify;
use tokio::time::{timeout, Duration};
use tracing::{error, warn};

use crate::config::update_config::FLUSH_PUBLISH_TIMEOUT_SECS;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::ResultStore;

/// Publishes status events through the durable outbox, so a report survives a disconnect.
#[derive(Clone)]
pub(super) struct StatusOutbox {
    publisher: NatsMessagePublisher,
    store: Arc<ResultStore>,
    flush: Arc<Notify>,
}

impl StatusOutbox {
    pub(super) fn new(
        publisher: NatsMessagePublisher,
        store: Arc<ResultStore>,
        flush: Arc<Notify>,
    ) -> Self {
        Self {
            publisher,
            store,
            flush,
        }
    }

    pub(super) async fn publish(
        &self,
        kind: &str,
        subject: String,
        event_id: &str,
        bytes: Vec<u8>,
    ) {
        if self.store.enabled() {
            let at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|elapsed| elapsed.as_nanos())
                .unwrap_or_default();
            match self
                .store
                .enqueue(outbox_key(kind, at, event_id), subject, bytes)
                .await
            {
                Ok(()) => self.flush.notify_one(),
                Err(e) => error!(
                    event_id,
                    kind, "Failed to persist a status event, it is lost: {:#}", e
                ),
            }
            return;
        }
        let published = timeout(
            Duration::from_secs(FLUSH_PUBLISH_TIMEOUT_SECS),
            self.publisher.publish_acked(&subject, &bytes),
        )
        .await
        .unwrap_or_else(|_| Err(anyhow::anyhow!("publish timed out")));
        if let Err(e) = published {
            warn!(
                event_id,
                kind, "Failed to publish a status event without a durable store: {:#}", e
            );
        }
    }
}

/// Time first: the outbox sends in key order, so the events of a request leave in the order they happened.
fn outbox_key(kind: &str, unix_nanos: u128, event_id: &str) -> String {
    format!("{kind}:{unix_nanos:020}:{event_id}")
}

#[cfg(test)]
#[path = "status_outbox_tests.rs"]
mod tests;
