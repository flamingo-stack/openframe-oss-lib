use anyhow::{anyhow, bail, Result};
use async_nats::Message;
use futures::StreamExt;
use serde::Deserialize;
use tokio::sync::OwnedRwLockReadGuard;
use tracing::{error, info, warn};

use super::{Begin, CommandHandler, CommandListener, Outcome};
use crate::models::{DeliveryRef, DeliveryResultMessage};
use crate::services::result_store::LedgerState;

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
        .settle(&machine_id, DeliveryResultMessage::done(delivery))
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

    match context.delivery.state(&delivery).await {
        Ok(None) => {}
        Ok(Some(LedgerState::Settled(result))) => {
            info!(kind = H::KIND, dispatch_id = %dispatch_id, "Repeat of a settled command, re-sending its result");
            context.delivery.settle(machine_id, result).await;
            return;
        }
        Ok(Some(_)) => {
            info!(kind = H::KIND, dispatch_id = %dispatch_id, "Repeat of a command still running, dropping");
            return;
        }
        Err(e) => {
            error!(kind = H::KIND, dispatch_id = %dispatch_id, "Failed to read the command record, leaving it to the backend retry: {:#}", e);
            return;
        }
    }

    let command = match serde_json::from_slice::<H::Command>(&message.payload) {
        Ok(command) => command,
        Err(e) => {
            error!(kind = H::KIND, dispatch_id = %dispatch_id, "Failed to parse command message: {:#}", e);
            let failed = DeliveryResultMessage::failed(delivery, format!("malformed payload: {e}"));
            context.delivery.settle(machine_id, failed).await;
            return;
        }
    };

    if H::SEQUENCED {
        let floor = listener.handler.applied_sequence(machine_id);
        if let Some(applied) = context.delivery.stale(machine_id, &delivery, floor).await {
            info!(kind = H::KIND, dispatch_id = %dispatch_id, sequence = ?delivery.sequence, applied, "Stale sequence, a newer one is already applied");
            context.delivery.acked(machine_id, &delivery).await;
            let done = DeliveryResultMessage::done(delivery);
            context.delivery.settle(machine_id, done).await;
            return;
        }
    }

    let guard = match listener.handler.begin(&command) {
        Begin::Accepted(guard) => guard,
        Begin::Busy(reason) => {
            info!(kind = H::KIND, dispatch_id = %dispatch_id, "Not started ({}), leaving the command to the backend retry", reason);
            return;
        }
    };

    let state = if H::RESTARTS_AGENT {
        LedgerState::AwaitingRestart
    } else {
        LedgerState::InFlight
    };
    if let Err(e) = context.delivery.accept(machine_id, &delivery, state).await {
        error!(kind = H::KIND, dispatch_id = %dispatch_id, "Failed to record the command, leaving it to the backend retry: {:#}", e);
        return;
    }
    context.delivery.acked(machine_id, &delivery).await;
    let outcome = listener
        .handler
        .run(machine_id, &delivery, command, guard)
        .await;
    conclude(listener, machine_id, delivery, outcome, admitted).await;
}

async fn conclude<H: CommandHandler>(
    listener: &CommandListener<H>,
    machine_id: &str,
    delivery: DeliveryRef,
    outcome: Outcome,
    admitted: OwnedRwLockReadGuard<()>,
) {
    let context = &listener.context;
    let dispatch_id = delivery.dispatch_id.clone();
    // Restarting is left out: UpdateHandlerService records it once the next start settles it done
    if H::SEQUENCED && matches!(outcome, Outcome::Done | Outcome::RestartRequired) {
        context.delivery.record_applied(machine_id, &delivery).await;
    }

    match outcome {
        Outcome::Restarting => {
            info!(kind = H::KIND, dispatch_id = %dispatch_id, "Command restarts the agent, the next start reports it")
        }
        Outcome::RestartRequired => {
            info!(kind = H::KIND, dispatch_id = %dispatch_id, "Command applied, restart required");
            context.delivery.await_restart(&delivery).await;
            drop(admitted);
            context.restart.drain_and_request().await;
        }
        Outcome::Done if H::REMOVES_AGENT => {
            info!(kind = H::KIND, dispatch_id = %dispatch_id, "Command done, removing the agent");
            let done = DeliveryResultMessage::done(delivery);
            if !context.delivery.settle_now(machine_id, done).await {
                warn!(kind = H::KIND, dispatch_id = %dispatch_id, "Done could not be reported, removing the agent anyway; the backend closes the command on timeout");
            }
            listener.handler.remove_agent().await;
        }
        Outcome::Done => {
            info!(kind = H::KIND, dispatch_id = %dispatch_id, "Command done");
            let done = DeliveryResultMessage::done(delivery);
            context.delivery.settle(machine_id, done).await;
        }
        Outcome::Failed(reason) => {
            error!(kind = H::KIND, dispatch_id = %dispatch_id, "Command failed: {}", reason);
            let failed = DeliveryResultMessage::failed(delivery, reason);
            context.delivery.settle(machine_id, failed).await;
        }
    }
}
