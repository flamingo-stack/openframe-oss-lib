use anyhow::{anyhow, bail, Result};
use futures::StreamExt;
use tokio::time::Duration;
use tracing::{error, info, warn};

use crate::config::updater_config::RECONNECTION_DELAY_MS;
use crate::models::{
    client_update_delivery_subject, ClientUpdateMessage, DeliveryEnvelope, DeliveryResultMessage,
};
use crate::services::client_update_service::UpdateOutcome;
use crate::services::delivery_ledger::DeliveryLedger;
use crate::services::delivery_reporter::DeliveryReporter;
use crate::services::{AgentConfigurationService, ClientUpdateService, NatsConnectionManager};

/// The delivery engine's CLIENT_UPDATE, one per machine on machine.{id}.client-update.v2:
/// the backend paces the rollout, retries and catches up offline machines, and reads
/// the outcome from machine.{id}.delivery.result.
#[derive(Clone)]
pub struct ClientUpdateDeliveryListener {
    nats: NatsConnectionManager,
    update_service: ClientUpdateService,
    config_service: AgentConfigurationService,
    reporter: DeliveryReporter,
    ledger: DeliveryLedger,
}

impl ClientUpdateDeliveryListener {
    pub fn new(
        nats: NatsConnectionManager,
        update_service: ClientUpdateService,
        config_service: AgentConfigurationService,
        reporter: DeliveryReporter,
        ledger: DeliveryLedger,
    ) -> Self {
        Self {
            nats,
            update_service,
            config_service,
            reporter,
            ledger,
        }
    }

    pub async fn start(&self) -> tokio::task::JoinHandle<()> {
        let listener = self.clone();
        tokio::spawn(async move {
            loop {
                info!("Starting client-update delivery listener");
                match listener.listen().await {
                    Ok(()) => info!("Client-update delivery listener rebinding"),
                    Err(e) => error!("Client-update delivery listener error: {:#}", e),
                }
                tokio::time::sleep(Duration::from_millis(RECONNECTION_DELAY_MS)).await;
            }
        })
    }

    async fn listen(&self) -> Result<()> {
        let machine_id = self.config_service.get_machine_id().await?;
        let mut client_rx = self.nats.on_client_replaced();
        let client = self.nats.get_client().await?;

        let subject = client_update_delivery_subject(&machine_id);
        let mut subscriber = client
            .subscribe(subject.clone())
            .await
            .map_err(|e| anyhow!("failed to subscribe to {}: {}", subject, e))?;
        info!(subject = %subject, "Client-update delivery listener active");

        loop {
            tokio::select! {
                message = subscriber.next() => match message {
                    Some(message) => self.handle(&message.payload).await,
                    None => bail!("subscription to {} ended", subject),
                },
                _ = client_rx.changed() => {
                    info!("NATS client replaced, resubscribing to client-update deliveries");
                    return Ok(());
                }
            }
        }
    }

    async fn handle(&self, payload: &[u8]) {
        let delivery = match serde_json::from_slice::<DeliveryEnvelope>(payload) {
            Ok(envelope) => envelope.delivery,
            Err(e) => {
                error!(
                    "Client update without a valid delivery block, dropping: {:#}",
                    e
                );
                return;
            }
        };
        let dispatch_id = delivery.dispatch_id.clone();

        // An older client answers this subject itself; a second answer would race it.
        if !self.update_service.client_delegates_updates() {
            info!(%dispatch_id, "The running client updates itself, leaving the delivery to it");
            return;
        }

        if let Some(result) = self.ledger.settled(&dispatch_id) {
            info!(%dispatch_id, "Repeat of a settled client update, re-sending its result");
            self.reporter.settle(result).await;
            return;
        }

        let update = match serde_json::from_slice::<ClientUpdateMessage>(payload) {
            Ok(update) => update,
            Err(e) => {
                error!(%dispatch_id, "Failed to parse client update: {:#}", e);
                let failed =
                    DeliveryResultMessage::failed(delivery, format!("malformed payload: {e}"));
                self.reporter.settle(failed).await;
                return;
            }
        };

        if let Some(sequence) = delivery.sequence {
            let applied = self.ledger.applied_sequence();
            if sequence <= applied {
                info!(%dispatch_id, sequence, applied, "Stale sequence, a newer client update is already applied");
                self.reporter.acked(&delivery).await;
                self.reporter
                    .settle(DeliveryResultMessage::done(delivery))
                    .await;
                return;
            }
        }

        let Some(slot) = self.update_service.try_reserve() else {
            info!(%dispatch_id, "Another client update is running, leaving the delivery to the backend retry");
            return;
        };

        self.reporter.acked(&delivery).await;
        let result = match self.update_service.apply(&update, &delivery, slot).await {
            UpdateOutcome::Done => {
                if let Some(sequence) = delivery.sequence {
                    if let Err(e) = self.ledger.record_applied(sequence) {
                        warn!(%dispatch_id, sequence, "Failed to record the applied sequence: {:#}", e);
                    }
                }
                DeliveryResultMessage::done(delivery)
            }
            UpdateOutcome::Failed(reason) => DeliveryResultMessage::failed(delivery, reason),
        };
        self.reporter.settle(result).await;
    }
}
