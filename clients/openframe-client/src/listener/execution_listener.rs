use std::marker::PhantomData;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use async_nats::Message;
use futures::StreamExt;
use tokio::sync::Notify;
use tokio::time::Duration;
use tracing::{error, info, warn};

use crate::config::update_config::{
    FALLBACK_PUBLISH_INITIAL_RETRY_DELAY_MS, FALLBACK_PUBLISH_MAX_RETRIES,
    FALLBACK_PUBLISH_MAX_RETRY_DELAY_MS, RECONNECTION_DELAY_MS,
};
use crate::models::{
    is_ack_subject, ExecutionAck, ExecutionMessage, ExecutionRequest, RmmResult, EXECUTION_ACK_KIND,
};
use crate::services::execution_service::ExecutionService;
use crate::services::nats_connection_manager::NatsConnectionManager;
use crate::services::nats_message_publisher::NatsMessagePublisher;
use crate::services::result_store::{
    entry_key, now_secs, payload_limit, JournalRecord, ResultStore,
};
use crate::services::AgentConfigurationService;

pub struct ExecutionListener<M> {
    nats_connection_manager: NatsConnectionManager,
    nats_message_publisher: NatsMessagePublisher,
    execution_service: ExecutionService,
    config_service: AgentConfigurationService,
    result_store: Arc<ResultStore>,
    flush_notify: Arc<Notify>,
    _marker: PhantomData<fn() -> M>,
}

impl<M> Clone for ExecutionListener<M> {
    fn clone(&self) -> Self {
        Self {
            nats_connection_manager: self.nats_connection_manager.clone(),
            nats_message_publisher: self.nats_message_publisher.clone(),
            execution_service: self.execution_service.clone(),
            config_service: self.config_service.clone(),
            result_store: self.result_store.clone(),
            flush_notify: self.flush_notify.clone(),
            _marker: PhantomData,
        }
    }
}

impl<M: ExecutionMessage + 'static> ExecutionListener<M> {
    pub fn new(
        nats_connection_manager: NatsConnectionManager,
        nats_message_publisher: NatsMessagePublisher,
        execution_service: ExecutionService,
        config_service: AgentConfigurationService,
        result_store: Arc<ResultStore>,
        flush_notify: Arc<Notify>,
    ) -> Self {
        Self {
            nats_connection_manager,
            nats_message_publisher,
            execution_service,
            config_service,
            result_store,
            flush_notify,
            _marker: PhantomData,
        }
    }

    pub async fn start(&self) -> Result<tokio::task::JoinHandle<()>> {
        let listener = self.clone();
        let handle = tokio::spawn(async move {
            loop {
                info!(kind = M::KIND, "Starting execution listener...");
                match listener.listen().await {
                    Ok(_) => warn!(
                        kind = M::KIND,
                        "Execution listener exited normally (unexpected)"
                    ),
                    Err(e) => error!(kind = M::KIND, "Execution listener error: {:#}", e),
                }
                info!(
                    kind = M::KIND,
                    delay_ms = RECONNECTION_DELAY_MS,
                    "Reconnecting execution listener..."
                );
                tokio::time::sleep(Duration::from_millis(RECONNECTION_DELAY_MS)).await;
            }
        });
        Ok(handle)
    }

    async fn listen(&self) -> Result<()> {
        let client = self.nats_connection_manager.get_client().await?;
        let machine_id = self.config_service.get_machine_id()?;

        let subject = format!("machine.{}.{}", machine_id, M::KIND);
        let subscriber = client
            .subscribe(subject.clone())
            .await
            .map_err(|e| anyhow!("failed to subscribe to {}: {}", subject, e))?;

        info!(subject = %subject, "Execution listener active");

        let queued = subscriber.inspect(|_| info!(kind = M::KIND, "Execution message received"));

        let listener = self.clone();
        run_unbounded(queued, move |message| {
            let listener = listener.clone();
            let machine_id = machine_id.clone();
            async move {
                if let Err(e) = listener.handle_message(message, &machine_id).await {
                    error!(
                        kind = M::KIND,
                        "Failed to handle execution message: {:#}", e
                    );
                }
            }
        })
        .await;

        Ok(())
    }

    async fn handle_message(&self, message: Message, machine_id: &str) -> Result<()> {
        let payload = String::from_utf8_lossy(&message.payload);
        let parsed = match M::from_payload(&payload) {
            Ok(m) => m,
            Err(e) => {
                error!(kind = M::KIND, error = %e, "Failed to parse execution message, skipping");
                return Ok(());
            }
        };
        let execution_id = parsed.execution_id().to_string();
        let schedule_id = parsed.schedule_id().unwrap_or("-").to_string();
        let requests = parsed.to_requests();
        info!(kind = M::KIND, execution_id = %execution_id, schedule_id = %schedule_id, scripts = requests.len(), "Execution request received");

        self.acknowledge_receipt(machine_id, &execution_id, parsed.schedule_id(), &requests)
            .await;

        let result_subject = format!("machine.{}.{}.result", machine_id, M::RESULT_KIND);

        if M::DURABLE && self.result_store.enabled() {
            self.handle_durable(
                requests,
                machine_id,
                &result_subject,
                &execution_id,
                &schedule_id,
            )
            .await;
        } else {
            for request in requests {
                let script_id = request.script_id.unwrap_or("-").to_string();
                let result = self.execution_service.execute(&request, machine_id).await;
                log_finished(&execution_id, &schedule_id, &script_id, &result);
                let key = entry_key(request.execution_id, request.script_id);
                let bytes = self.encode_for_publish(&result).await;
                self.deliver(key, &result_subject, bytes).await;
            }
        }

        Ok(())
    }

    async fn acknowledge_receipt(
        &self,
        machine_id: &str,
        execution_id: &str,
        schedule_id: Option<&str>,
        requests: &[ExecutionRequest<'_>],
    ) {
        let ack = ExecutionAck {
            execution_id: execution_id.to_string(),
            machine_id: machine_id.to_string(),
            schedule_id: schedule_id.map(str::to_string),
            script_ids: requests
                .iter()
                .filter_map(|r| r.script_id)
                .map(str::to_string)
                .collect(),
        };
        let bytes = match serde_json::to_vec(&ack) {
            Ok(bytes) => bytes,
            Err(e) => {
                error!(kind = M::KIND, execution_id = %execution_id, error = %e, "Failed to serialize execution ack");
                return;
            }
        };
        let subject = format!("machine.{}.{}", machine_id, EXECUTION_ACK_KIND);
        self.deliver(format!("ack:{execution_id}"), &subject, bytes)
            .await;
    }

    async fn encode_for_publish(&self, result: &RmmResult) -> Vec<u8> {
        let limit = payload_limit(self.nats_message_publisher.max_payload().await);
        ResultStore::encode_result(result, limit)
    }

    async fn deliver(&self, key: String, subject: &str, bytes: Vec<u8>) {
        if self.result_store.enabled() {
            self.enqueue_outbound(key, subject, bytes).await;
        } else {
            self.spawn_fallback_publish(subject.to_string(), bytes);
        }
    }

    async fn enqueue_outbound(&self, key: String, subject: &str, bytes: Vec<u8>) {
        match self
            .result_store
            .enqueue(key, subject.to_string(), bytes)
            .await
        {
            Ok(()) => self.flush_notify.notify_one(),
            Err(e) => {
                error!(kind = M::KIND, subject, error = %e, "Failed to enqueue outbound message, dropping")
            }
        }
    }

    fn spawn_fallback_publish(&self, subject: String, bytes: Vec<u8>) {
        let publisher = self.nats_message_publisher.clone();
        let acked = is_ack_subject(&subject);
        tokio::spawn(async move {
            let max_backoff = Duration::from_millis(FALLBACK_PUBLISH_MAX_RETRY_DELAY_MS);
            let mut backoff = Duration::from_millis(FALLBACK_PUBLISH_INITIAL_RETRY_DELAY_MS);
            for attempt in 1..=FALLBACK_PUBLISH_MAX_RETRIES {
                let published = if acked {
                    publisher.publish_acked(&subject, &bytes).await
                } else {
                    publisher.publish_raw(&subject, &bytes).await
                };
                match published {
                    Ok(()) => return,
                    Err(e) => {
                        warn!(kind = M::KIND, subject = %subject, attempt, error = %e, "Fallback publish failed, retrying in memory");
                        if attempt < FALLBACK_PUBLISH_MAX_RETRIES {
                            tokio::time::sleep(backoff).await;
                            backoff = (backoff * 2).min(max_backoff);
                        }
                    }
                }
            }
            error!(kind = M::KIND, subject = %subject, "Fallback publish gave up after retries, message lost");
        });
    }

    async fn handle_durable(
        &self,
        requests: Vec<ExecutionRequest<'_>>,
        machine_id: &str,
        result_subject: &str,
        execution_id: &str,
        schedule_id: &str,
    ) {
        let now = now_secs();
        let records: Vec<(String, JournalRecord)> = requests
            .iter()
            .map(|req| {
                let key = entry_key(req.execution_id, req.script_id);
                let record = JournalRecord {
                    subject: result_subject.to_string(),
                    execution_id: req.execution_id.to_string(),
                    schedule_id: req.schedule_id.map(str::to_string),
                    machine_id: machine_id.to_string(),
                    script_id: req.script_id.map(str::to_string),
                    started: false,
                    created_at_secs: now,
                };
                (key, record)
            })
            .collect();

        match self
            .result_store
            .journal_batch(execution_id.to_string(), records)
            .await
        {
            Ok(true) => {}
            Ok(false) => {
                warn!(kind = M::KIND, execution_id = %execution_id, "Batch already in flight, skipping redelivery");
                return;
            }
            Err(e) => {
                error!(kind = M::KIND, execution_id = %execution_id, error = %e, "Failed to persist batch, falling back to best-effort publish");
                self.publish_directly(
                    requests,
                    machine_id,
                    result_subject,
                    execution_id,
                    schedule_id,
                )
                .await;
                return;
            }
        }
        self.flush_notify.notify_one();

        for request in requests {
            let script_id = request.script_id.unwrap_or("-").to_string();
            let key = entry_key(request.execution_id, request.script_id);
            if let Err(e) = self.result_store.journal_mark_started(key.clone()).await {
                warn!(kind = M::KIND, execution_id = %execution_id, script_id = %script_id, error = %e, "Failed to mark script started");
            }
            let result = self.execution_service.execute(&request, machine_id).await;
            log_finished(execution_id, schedule_id, &script_id, &result);

            let bytes = self.encode_for_publish(&result).await;
            if let Err(e) = self
                .result_store
                .complete(key.clone(), result_subject.to_string(), bytes)
                .await
            {
                error!(kind = M::KIND, execution_id = %execution_id, script_id = %script_id, error = %e, "Failed to persist result, publishing best-effort");
                let bytes = self.encode_for_publish(&result).await;
                match self
                    .nats_message_publisher
                    .publish_raw(result_subject, &bytes)
                    .await
                {
                    Ok(()) => {
                        if let Err(re) = self.result_store.journal_remove(key).await {
                            warn!(kind = M::KIND, execution_id = %execution_id, script_id = %script_id, error = %re, "Delivered best-effort but failed to clear journal entry");
                        }
                    }
                    Err(pe) => {
                        error!(kind = M::KIND, execution_id = %execution_id, script_id = %script_id, error = %pe, "Best-effort publish also failed");
                    }
                }
            } else {
                self.flush_notify.notify_one();
            }
        }
    }

    async fn publish_directly(
        &self,
        requests: Vec<ExecutionRequest<'_>>,
        machine_id: &str,
        result_subject: &str,
        execution_id: &str,
        schedule_id: &str,
    ) {
        for request in requests {
            let script_id = request.script_id.unwrap_or("-").to_string();
            let result = self.execution_service.execute(&request, machine_id).await;
            log_finished(execution_id, schedule_id, &script_id, &result);
            let key = entry_key(request.execution_id, request.script_id);
            let bytes = self.encode_for_publish(&result).await;
            self.deliver(key, result_subject, bytes).await;
        }
    }
}

fn log_finished(execution_id: &str, schedule_id: &str, script_id: &str, result: &RmmResult) {
    info!(
        execution_id = %execution_id,
        schedule_id = %schedule_id,
        script_id = %script_id,
        exit_code = result.exit_code,
        timed_out = result.timed_out,
        execution_time_ms = result.execution_time_ms,
        "Execution finished"
    );
}

async fn run_unbounded<T, F, Fut>(stream: impl futures::Stream<Item = T>, handler: F)
where
    T: Send + 'static,
    F: Fn(T) -> Fut + Clone + Send + 'static,
    Fut: std::future::Future<Output = ()> + Send + 'static,
{
    tokio::pin!(stream);
    while let Some(item) = stream.next().await {
        tokio::spawn(handler.clone()(item));
    }
}

#[cfg(test)]
#[path = "execution_listener_tests.rs"]
mod tests;
