use anyhow::Result;
use serde::Serialize;
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};

const BATCH_SIZE: usize = 100;
const BATCH_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize)]
pub struct LogBatch {
    pub logs: Vec<String>,
    pub agent_id: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[allow(dead_code)] // endpoint/agent_id retained for future shipping use
pub struct LogShipper {
    sender: mpsc::Sender<String>,
    endpoint: String,
    agent_id: String,
    task_handle: Option<tokio::task::JoinHandle<()>>,
}

impl LogShipper {
    pub fn new(endpoint: String, agent_id: String) -> Self {
        let (sender, receiver) = mpsc::channel(1000);

        // Clone values before moving them
        let endpoint_clone = endpoint.clone();
        let agent_id_clone = agent_id.clone();

        // Spawn background shipping task
        let task_handle = tokio::spawn(async move {
            Self::ship_logs(receiver, endpoint_clone, agent_id_clone).await;
        });

        LogShipper {
            sender,
            endpoint,
            agent_id,
            task_handle: Some(task_handle),
        }
    }

    pub async fn send(&self, log: String) -> Result<()> {
        self.sender.send(log).await?;
        Ok(())
    }

    /// Signal the background shipping task to drain any remaining logs and
    /// shut down, then wait for it to finish.
    pub async fn shutdown(&mut self) {
        // Dropping the sender's clone is not enough since `self.sender` is
        // still held; explicitly close the channel by dropping it here isn't
        // possible without consuming `self`, so we rely on the receiver loop
        // exiting when all senders are dropped. Since `LogShipper` owns the
        // only sender, we take it out to close the channel now.
        if let Some(handle) = self.task_handle.take() {
            // Replace sender with a closed one to trigger receiver.recv() == None
            let (dummy_sender, _) = mpsc::channel(1);
            let _ = std::mem::replace(&mut self.sender, dummy_sender);

            if let Err(e) = handle.await {
                tracing::error!("Log shipping task failed during shutdown: {:#}", e);
            }
        }
    }

    async fn ship_logs(mut receiver: mpsc::Receiver<String>, endpoint: String, agent_id: String) {
        let mut batch = Vec::with_capacity(BATCH_SIZE);
        let client = reqwest::Client::new();

        loop {
            tokio::select! {
                // Wait for either a new log message or the batch timeout
                maybe_log = receiver.recv() => {
                    match maybe_log {
                        Some(log) => {
                            batch.push(log);

                            // Ship batch if it reaches max size
                            if batch.len() >= BATCH_SIZE {
                                if let Err(e) = Self::send_batch(&client, &endpoint, &agent_id, batch.clone()).await {
                                    tracing::error!("Failed to ship log batch: {:#}", e);
                                }
                                batch.clear();
                            }
                        }
                        None => {
                            // Channel closed (sender dropped / shutdown requested).
                            // Drain any remaining logs still in the channel buffer.
                            while let Ok(log) = receiver.try_recv() {
                                batch.push(log);
                            }
                            if !batch.is_empty() {
                                if let Err(e) = Self::send_batch(&client, &endpoint, &agent_id, batch.clone()).await {
                                    tracing::error!("Failed to ship log batch: {:#}", e);
                                }
                                batch.clear();
                            }
                            return;
                        }
                    }
                }
                _ = sleep(BATCH_TIMEOUT) => {
                    // Ship current batch if we have any logs
                    if !batch.is_empty() {
                        if let Err(e) = Self::send_batch(&client, &endpoint, &agent_id, batch.clone()).await {
                            tracing::error!("Failed to ship log batch: {:#}", e);
                        }
                        batch.clear();
                    }
                }
            }
        }
    }

    async fn send_batch(
        client: &reqwest::Client,
        endpoint: &str,
        agent_id: &str,
        logs: Vec<String>,
    ) -> Result<()> {
        let batch = LogBatch {
            logs,
            agent_id: agent_id.to_string(),
            timestamp: chrono::Utc::now(),
        };

        client
            .post(endpoint)
            .json(&batch)
            .send()
            .await?
            .error_for_status()?;

        Ok(())
    }
}

impl Drop for LogShipper {
    fn drop(&mut self) {
        // Best-effort: abort the background task if it hasn't been shut down
        // gracefully via `shutdown()`. This prevents the task from leaking
        // forever if the LogShipper is dropped without an explicit shutdown,
        // though any buffered logs in that case may still be lost.
        if let Some(handle) = self.task_handle.take() {
            handle.abort();
        }
    }
}
