use anyhow::{anyhow, bail, Result};
use async_nats::Message;
use futures::StreamExt;
use serde::Deserialize;
use tracing::{error, info, warn};

use super::{CommandHandler, CommandListener, Outcome};
use crate::models::DeliveryRef;

#[derive(Deserialize)]
struct Envelope {
    delivery: DeliveryRef,
}

pub(super) async fn report_restart_completion<H: CommandHandler>(listener: &CommandListener<H>) {
    let Some(delivery) = listener.handler.awaiting_restart() else {
        return;
    };
    let machine_id = match listener.context.config_service.get_machine_id() {
        Ok(machine_id) => machine_id,
        Err(e) => {
            error!(kind = H::KIND, dispatch_id = %delivery.dispatch_id, "Cannot resolve machine id to report the restart: {:#}", e);
            return;
        }
    };
    info!(kind = H::KIND, dispatch_id = %delivery.dispatch_id, "Applied after restart, reporting done");
    if !listener
        .context
        .delivery
        .settle(&machine_id, delivery, Outcome::Done)
        .await
    {
        return;
    }
    if let Err(e) = listener.handler.restart_reported() {
        warn!(
            kind = H::KIND,
            "Failed to clear the restart marker, done is re-sent on next start: {:#}", e
        );
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
        Ok(envelope) => envelope.delivery,
        Err(e) => {
            error!(
                kind = H::KIND,
                "Command message without a valid delivery block, dropping: {:#}", e
            );
            return;
        }
    };
    let context = &listener.context;
    let dispatch_id = delivery.dispatch_id.clone();

    let Some(admitted) = context.restart.admit() else {
        info!(kind = H::KIND, dispatch_id = %dispatch_id, "Restart pending, leaving the command to the backend retry");
        return;
    };

    let command = match serde_json::from_slice::<H::Command>(&message.payload) {
        Ok(command) => command,
        Err(e) => {
            error!(kind = H::KIND, dispatch_id = %dispatch_id, "Failed to parse command message: {:#}", e);
            context
                .delivery
                .settle(
                    machine_id,
                    delivery,
                    Outcome::Failed(format!("malformed payload: {e}")),
                )
                .await;
            return;
        }
    };

    context.delivery.acked(machine_id, &delivery).await;
    let outcome = listener.handler.run(machine_id, &delivery, command).await;
    match &outcome {
        Outcome::Done => info!(kind = H::KIND, dispatch_id = %dispatch_id, "Command done"),
        Outcome::RestartRequired => {
            info!(kind = H::KIND, dispatch_id = %dispatch_id, "Command applied, restart required")
        }
        Outcome::Failed(reason) => {
            error!(kind = H::KIND, dispatch_id = %dispatch_id, "Command failed: {}", reason)
        }
    }

    if outcome != Outcome::RestartRequired {
        context.delivery.settle(machine_id, delivery, outcome).await;
        return;
    }
    drop(admitted);
    context.restart.drain_and_request().await;
}
