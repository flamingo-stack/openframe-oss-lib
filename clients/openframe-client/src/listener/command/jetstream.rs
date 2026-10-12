use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use anyhow::{anyhow, Result};
use async_nats::jetstream::consumer::{push, PushConsumer};
use async_nats::jetstream::{self, AckKind, Context, Message};
use futures::StreamExt;
use tokio::time::Duration;
use tracing::{error, info, warn};

use super::{Begin, CommandHandler, CommandListener, JetStreamConsumer, Outcome};
use crate::config::update_config::{
    CONSUMER_ACK_WAIT_SECS, CONSUMER_CYCLE_PAUSE_MS, CONSUMER_RETRY_ATTEMPTS_PER_CYCLE,
    INITIAL_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS, PROGRESS_ACK_INTERVAL_SECS,
};
use crate::services::tool_run_manager::ToolRunManager;

pub(super) async fn listen<H: CommandHandler>(
    listener: &CommandListener<H>,
    consumer: JetStreamConsumer,
) -> Result<()> {
    let nats = &listener.context.nats_connection_manager;
    let machine_id = listener.context.config_service.get_machine_id()?;
    let config = consumer_config::<H>(consumer, &machine_id);
    let durable = (consumer.durable)(&machine_id);

    loop {
        let reprovisioning = Arc::new(AtomicBool::new(false));
        let mut client_rx = nats.on_client_replaced();
        let client = nats.get_client().await?;
        let mut reconnect_rx = nats.subscribe_reconnect();
        let js = jetstream::new((*client).clone());

        let push_consumer = tokio::select! {
            push_consumer = create_consumer(&js, consumer.stream, &config, &durable) => push_consumer,
            _ = client_rx.changed() => {
                info!(kind = H::KIND, "NATS client replaced, rebinding consumer");
                continue;
            }
        };

        info!(kind = H::KIND, "Start listening for messages");
        let mut messages = push_consumer.messages().await?;

        loop {
            tokio::select! {
                message = messages.next() => {
                    match message {
                        Some(Ok(message)) => handle(listener, message).await,
                        Some(Err(e)) => {
                            error!(kind = H::KIND, "Message stream error, recreating consumer: {:#}", e);
                            return Err(anyhow!("Message stream error: {}", e));
                        }
                        None => {
                            warn!(kind = H::KIND, "Message stream ended, rebinding consumer");
                            break;
                        }
                    }
                }
                _ = client_rx.changed() => {
                    info!(kind = H::KIND, "NATS client replaced, rebinding consumer");
                    break;
                }
                _ = reconnect_rx.recv() => {
                    info!(kind = H::KIND, "NATS reconnected, re-provisioning consumer");
                    if !reprovisioning.swap(true, Ordering::SeqCst) {
                        let js = js.clone();
                        let config = config.clone();
                        let durable = durable.clone();
                        let reprovisioning = reprovisioning.clone();
                        let mut client_rx = client_rx.clone();
                        tokio::spawn(async move {
                            tokio::select! {
                                _ = create_consumer(&js, consumer.stream, &config, &durable) => {}
                                _ = client_rx.changed() => {}
                            }
                            reprovisioning.store(false, Ordering::SeqCst);
                        });
                    }
                }
            }
        }
    }
}

async fn handle<H: CommandHandler>(listener: &CommandListener<H>, message: Message) {
    let payload = String::from_utf8_lossy(&message.payload);
    info!(kind = H::KIND, "Received command message: {:?}", payload);

    let command: H::Command = match serde_json::from_slice(&message.payload) {
        Ok(command) => command,
        Err(e) => {
            error!(kind = H::KIND, "Failed to parse command message: {:#}", e);
            if let Err(ack_err) = message.ack().await {
                warn!(
                    kind = H::KIND,
                    "Failed to ack malformed message: {}", ack_err
                );
            }
            return;
        }
    };

    let label = H::label(&command);
    let handler = listener.handler.clone();
    if !H::PARK_DURING_CLIENT_UPDATE {
        execute(handler, message, command, label).await;
        return;
    }
    park_or_dispatch(
        listener.context.tool_run_manager.clone(),
        message,
        format!("{}:{}", H::KIND, label),
        move |message| execute(handler, message, command, label),
    )
    .await;
}

async fn execute<H: CommandHandler>(
    handler: H,
    message: Message,
    command: H::Command,
    label: String,
) {
    let outcome = match handler.begin(&command).await {
        Begin::Accepted(guard) => handler.run(command, guard).await,
        Begin::Busy => Outcome::Failed("busy with another operation".to_string()),
    };
    match outcome {
        Outcome::Done => match message.ack().await {
            Ok(()) => info!(kind = H::KIND, label = %label, "Command message acknowledged"),
            Err(e) => {
                error!(kind = H::KIND, label = %label, "Failed to ack command message: {}", e)
            }
        },
        Outcome::Failed(reason) => warn!(
            kind = H::KIND,
            label = %label,
            "Command not completed, leaving message unacked for redelivery: {}",
            reason
        ),
    }
}

async fn park_or_dispatch<F, Fut>(
    manager: ToolRunManager,
    message: Message,
    label: String,
    dispatch: F,
) where
    F: FnOnce(Message) -> Fut + Send + 'static,
    Fut: Future<Output = ()> + Send + 'static,
{
    if !manager.is_client_update_pending().await {
        dispatch(message).await;
        return;
    }

    info!(
        "Client update pending: parking {} (keeping it alive with Progress acks every {}s)",
        label, PROGRESS_ACK_INTERVAL_SECS
    );

    tokio::spawn(async move {
        while manager.is_client_update_pending().await {
            if let Err(e) = message.ack_with(AckKind::Progress).await {
                warn!(
                    "Failed to send Progress ack for parked {}: {} — abandoning park, redelivery takes over",
                    label, e
                );
                return;
            }
            tokio::time::sleep(Duration::from_secs(PROGRESS_ACK_INTERVAL_SECS)).await;
        }

        info!(
            "Client update no longer pending: dispatching parked {}",
            label
        );
        dispatch(message).await;
    });
}

pub(super) fn consumer_config<H: CommandHandler>(
    consumer: JetStreamConsumer,
    machine_id: &str,
) -> push::Config {
    push::Config {
        filter_subject: H::subject(machine_id),
        deliver_subject: (consumer.deliver_subject)(machine_id),
        durable_name: Some((consumer.durable)(machine_id)),
        ack_wait: Duration::from_secs(CONSUMER_ACK_WAIT_SECS),
        deliver_policy: consumer.deliver_policy,
        max_deliver: consumer.max_deliver,
        ..Default::default()
    }
}

async fn create_consumer(
    js: &Context,
    stream: &str,
    config: &push::Config,
    durable: &str,
) -> PushConsumer {
    info!(
        "Consumer configuration - stream: {}, filter subject: {}, deliver subject: {}, durable name: {}",
        stream, config.filter_subject, config.deliver_subject, durable
    );
    let mut cycle = 0u32;

    loop {
        cycle += 1;
        let mut delay_ms = INITIAL_RETRY_DELAY_MS;

        for attempt in 1..=CONSUMER_RETRY_ATTEMPTS_PER_CYCLE {
            info!(
                "Creating consumer {} for stream {} (cycle {}, attempt {}/{})",
                durable, stream, cycle, attempt, CONSUMER_RETRY_ATTEMPTS_PER_CYCLE
            );

            match js.create_consumer_on_stream(config.clone(), stream).await {
                Ok(consumer) => {
                    info!("Consumer {} created for stream: {}", durable, stream);
                    return consumer;
                }
                Err(e) => {
                    let error_msg = format!("{:?}", e);
                    if error_msg.contains("consumer name already in use")
                        || error_msg.contains("10013")
                    {
                        warn!(
                            "Consumer {} already exists, attempting to get existing consumer",
                            durable
                        );
                        if let Ok(existing) = js.get_consumer_from_stream(stream, durable).await {
                            info!(
                                "Retrieved existing consumer {} for stream: {}",
                                durable, stream
                            );
                            return existing;
                        }
                    }

                    if attempt < CONSUMER_RETRY_ATTEMPTS_PER_CYCLE {
                        warn!(
                            "Failed to create consumer {} (cycle {}, attempt {}/{}): {:#}. Retrying in {} ms...",
                            durable, cycle, attempt, CONSUMER_RETRY_ATTEMPTS_PER_CYCLE, e, delay_ms
                        );
                        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                        delay_ms = (delay_ms * 2).min(MAX_RETRY_DELAY_MS);
                    } else {
                        warn!(
                            "Failed to create consumer {} (cycle {}, attempt {}/{}): {:#}",
                            durable, cycle, attempt, CONSUMER_RETRY_ATTEMPTS_PER_CYCLE, e
                        );
                    }
                }
            }
        }

        info!(
            "All {} attempts in cycle {} failed. Pausing {} seconds before next cycle...",
            CONSUMER_RETRY_ATTEMPTS_PER_CYCLE,
            cycle,
            CONSUMER_CYCLE_PAUSE_MS / 1000
        );
        tokio::time::sleep(Duration::from_millis(CONSUMER_CYCLE_PAUSE_MS)).await;
    }
}
