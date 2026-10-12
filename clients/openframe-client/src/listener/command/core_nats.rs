use anyhow::{anyhow, bail, Result};
use async_nats::Message;
use futures::StreamExt;
use serde::Deserialize;
use tokio::time::{timeout, Duration};
use tracing::{error, info, warn};

use super::{Begin, CommandContext, CommandHandler, CommandListener, Outcome, RetiredConsumer};
use crate::config::update_config::RETIRED_CONSUMER_DELETE_TIMEOUT_SECS;
use crate::models::DeliveryRef;
use crate::services::result_store::DeliveryClaim;

#[derive(Deserialize)]
struct Envelope {
    #[serde(default)]
    delivery: Option<serde_json::Value>,
}

pub(super) async fn retire<H: CommandHandler>(context: &CommandContext, retired: RetiredConsumer) {
    let machine_id = match context.config_service.get_machine_id() {
        Ok(machine_id) => machine_id,
        Err(e) => {
            warn!(
                kind = H::KIND,
                "Cannot resolve machine id to delete the retired consumer: {:#}", e
            );
            return;
        }
    };
    let client = match context.nats_connection_manager.get_client().await {
        Ok(client) => client,
        Err(e) => {
            warn!(
                kind = H::KIND,
                "Cannot reach NATS to delete the retired consumer: {:#}", e
            );
            return;
        }
    };
    let durable = (retired.durable)(&machine_id);
    let js = async_nats::jetstream::new((*client).clone());
    match timeout(
        Duration::from_secs(RETIRED_CONSUMER_DELETE_TIMEOUT_SECS),
        js.delete_consumer_from_stream(&durable, retired.stream),
    )
    .await
    {
        Ok(Ok(_)) => {
            info!(kind = H::KIND, durable = %durable, stream = retired.stream, "Deleted retired JetStream consumer")
        }
        Ok(Err(e)) => {
            info!(kind = H::KIND, durable = %durable, stream = retired.stream, "Retired JetStream consumer not deleted: {}", e)
        }
        Err(_) => {
            warn!(kind = H::KIND, durable = %durable, stream = retired.stream, "Timed out deleting retired JetStream consumer")
        }
    }
}

pub(super) async fn listen<H: CommandHandler>(listener: &CommandListener<H>) -> Result<()> {
    let nats = &listener.context.nats_connection_manager;
    let mut client_rx = nats.on_client_replaced();
    let client = nats.get_client().await?;
    let machine_id = listener.context.config_service.get_machine_id()?;

    let subject = H::subject(&machine_id);
    let mut subscriber = client
        .subscribe(subject.clone())
        .await
        .map_err(|e| anyhow!("failed to subscribe to {}: {}", subject, e))?;
    info!(kind = H::KIND, subject = %subject, "Command listener active");

    loop {
        tokio::select! {
            message = subscriber.next() => match message {
                Some(message) => handle(listener, message, &machine_id).await,
                None => bail!("subscription to {} ended", subject),
            },
            _ = client_rx.changed() => {
                info!(kind = H::KIND, "NATS client replaced, resubscribing");
                return Ok(());
            }
        }
    }
}

async fn handle<H: CommandHandler>(
    listener: &CommandListener<H>,
    message: Message,
    machine_id: &str,
) {
    let payload = String::from_utf8_lossy(&message.payload);
    info!(kind = H::KIND, "Received command message: {:?}", payload);

    let delivery = match serde_json::from_slice::<Envelope>(&message.payload) {
        Ok(Envelope { delivery: None }) => None,
        Ok(Envelope {
            delivery: Some(value),
        }) => match serde_json::from_value::<DeliveryRef>(value) {
            Ok(delivery) => Some(delivery),
            Err(e) => {
                error!(
                    kind = H::KIND,
                    "Malformed delivery block, dropping message: {:#}", e
                );
                return;
            }
        },
        Err(e) => {
            error!(
                kind = H::KIND,
                "Failed to parse command message, dropping: {:#}", e
            );
            return;
        }
    };

    match (
        delivery,
        serde_json::from_slice::<H::Command>(&message.payload),
    ) {
        (Some(delivery), Ok(command)) => deliver(listener, machine_id, delivery, command).await,
        (Some(delivery), Err(e)) => {
            error!(kind = H::KIND, dispatch_id = %delivery.dispatch_id, "Failed to parse command message: {:#}", e);
            listener
                .context
                .delivery
                .settle(
                    machine_id,
                    delivery,
                    Outcome::Failed(format!("malformed payload: {e}")),
                )
                .await;
        }
        (None, Ok(command)) => run_legacy(listener, command).await,
        (None, Err(e)) => error!(
            kind = H::KIND,
            "Failed to parse command message, dropping: {:#}", e
        ),
    }
}

async fn deliver<H: CommandHandler>(
    listener: &CommandListener<H>,
    machine_id: &str,
    delivery: DeliveryRef,
    command: H::Command,
) {
    let context = &listener.context;
    let label = H::label(&command);
    let dispatch_id = delivery.dispatch_id.clone();

    if H::PARK_DURING_CLIENT_UPDATE && context.tool_run_manager.is_client_update_pending().await {
        info!(kind = H::KIND, label = %label, dispatch_id = %dispatch_id, "Client update pending, leaving the command to the backend retry");
        return;
    }

    match context.delivery.claim(machine_id, &delivery).await {
        Ok(DeliveryClaim::Claimed) => {}
        Ok(DeliveryClaim::InFlight) => {
            info!(kind = H::KIND, label = %label, dispatch_id = %dispatch_id, "Duplicate of a delivery in flight, dropping");
            return;
        }
        Ok(DeliveryClaim::Resent) => {
            info!(kind = H::KIND, label = %label, dispatch_id = %dispatch_id, "Delivery already settled, result re-sent");
            return;
        }
        Err(e) => {
            error!(kind = H::KIND, label = %label, dispatch_id = %dispatch_id, "Failed to claim delivery, leaving the command to the backend retry: {:#}", e);
            return;
        }
    }

    let guard = match listener.handler.begin(&command).await {
        Begin::Accepted(guard) => guard,
        Begin::Busy => {
            info!(kind = H::KIND, label = %label, dispatch_id = %dispatch_id, "Busy with another operation, leaving the command to the backend retry");
            context.delivery.release(&delivery).await;
            return;
        }
    };

    context.delivery.acked(machine_id, &delivery).await;
    let outcome = listener.handler.run(command, guard).await;
    match &outcome {
        Outcome::Done => {
            info!(kind = H::KIND, label = %label, dispatch_id = %dispatch_id, "Command done")
        }
        Outcome::Failed(reason) => {
            error!(kind = H::KIND, label = %label, dispatch_id = %dispatch_id, "Command failed: {}", reason)
        }
    }
    context.delivery.settle(machine_id, delivery, outcome).await;
}

async fn run_legacy<H: CommandHandler>(listener: &CommandListener<H>, command: H::Command) {
    let label = H::label(&command);

    if H::PARK_DURING_CLIENT_UPDATE
        && listener
            .context
            .tool_run_manager
            .is_client_update_pending()
            .await
    {
        warn!(kind = H::KIND, label = %label, "Client update pending, dropping command without a delivery block");
        return;
    }

    let guard = match listener.handler.begin(&command).await {
        Begin::Accepted(guard) => guard,
        Begin::Busy => {
            warn!(kind = H::KIND, label = %label, "Busy with another operation, dropping command without a delivery block");
            return;
        }
    };

    match listener.handler.run(command, guard).await {
        Outcome::Done => info!(kind = H::KIND, label = %label, "Command done"),
        Outcome::Failed(reason) => {
            error!(kind = H::KIND, label = %label, "Command failed: {}", reason)
        }
    }
}
