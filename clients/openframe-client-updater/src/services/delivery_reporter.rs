use anyhow::{anyhow, Result};
use tokio::time::{timeout, Duration};
use tracing::{info, warn};

use crate::config::updater_config::{RESULT_PUBLISH_TIMEOUT_SECS, RESULT_RESEND_INTERVAL_SECS};
use crate::models::{delivery_result_subject, DeliveryRef, DeliveryResult, DeliveryResultMessage};
use crate::services::delivery_ledger::DeliveryLedger;
use crate::services::NatsMessagePublisher;

/// Answers delivery-engine commands on machine.{id}.delivery.result: ACKED best
/// effort, DONE and FAILED kept in the ledger until their stream has stored them.
#[derive(Clone)]
pub struct DeliveryReporter {
    publisher: NatsMessagePublisher,
    ledger: DeliveryLedger,
    subject: String,
}

impl DeliveryReporter {
    pub fn new(publisher: NatsMessagePublisher, ledger: DeliveryLedger, machine_id: &str) -> Self {
        Self {
            publisher,
            ledger,
            subject: delivery_result_subject(machine_id),
        }
    }

    pub async fn acked(&self, delivery: &DeliveryRef) {
        let message = DeliveryResultMessage::acked(delivery.clone());
        match self.send(&message).await {
            Ok(()) => info!(dispatch_id = %delivery.dispatch_id, "Delivery ACKED"),
            Err(e) => warn!(
                dispatch_id = %delivery.dispatch_id,
                "Failed to report ACKED, the backend retry re-sends the command: {:#}", e
            ),
        }
    }

    /// Records the final result, then publishes it; one that does not go out now is
    /// published again by the resend loop.
    pub async fn settle(&self, message: DeliveryResultMessage) {
        if let Err(e) = self.ledger.settle(message.clone()) {
            warn!(
                dispatch_id = %message.delivery.dispatch_id,
                "Failed to record the delivery result, publishing it once: {:#}", e
            );
        }
        self.publish(message).await;
    }

    pub fn start_resend_loop(&self) -> tokio::task::JoinHandle<()> {
        let reporter = self.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(RESULT_RESEND_INTERVAL_SECS)).await;
                for message in reporter.ledger.unpublished() {
                    reporter.publish(message).await;
                }
            }
        })
    }

    async fn publish(&self, message: DeliveryResultMessage) {
        let dispatch_id = message.delivery.dispatch_id.clone();
        let result = message.result;
        match self.send(&message).await {
            Ok(()) => {
                info!(%dispatch_id, ?result, "Delivery result published");
                if let Err(e) = self.ledger.mark_published(&dispatch_id) {
                    warn!(%dispatch_id, "Failed to mark the result published, it may go out twice: {:#}", e);
                }
            }
            Err(e) => warn!(
                %dispatch_id,
                ?result,
                "Failed to publish the delivery result, retrying in {}s: {:#}",
                RESULT_RESEND_INTERVAL_SECS,
                e
            ),
        }
    }

    // ACKED goes out best effort, a result only once its stream stored it.
    async fn send(&self, message: &DeliveryResultMessage) -> Result<()> {
        let bytes = serde_json::to_vec(message)?;
        let send = async {
            if message.result == DeliveryResult::Acked {
                self.publisher.publish_raw(&self.subject, &bytes).await
            } else {
                self.publisher.publish_acked(&self.subject, &bytes).await
            }
        };
        timeout(Duration::from_secs(RESULT_PUBLISH_TIMEOUT_SECS), send)
            .await
            .unwrap_or_else(|_| Err(anyhow!("publish timed out")))
    }
}
