use anyhow::{Context, Result};
use serde::Serialize;

use crate::services::nats_connection_manager::NatsConnectionManager;

#[derive(Clone)]
pub struct NatsMessagePublisher {
    nats_connection_manager: NatsConnectionManager,
}

impl NatsMessagePublisher {
    pub fn new(nats_connection_manager: NatsConnectionManager) -> Self {
        Self {
            nats_connection_manager,
        }
    }

    /// Fire and forget, flushed so it leaves before the caller moves on.
    pub async fn publish_raw(&self, subject: &str, bytes: &[u8]) -> Result<()> {
        let client = self.nats_connection_manager.get_client().await?;
        client
            .publish(subject.to_string(), bytes.to_vec().into())
            .await
            .context("Failed to publish message to NATS")?;
        client.flush().await.context("Failed to flush NATS publish")
    }

    /// Returns once the stream capturing `subject` has stored the message.
    pub async fn publish_acked(&self, subject: &str, bytes: &[u8]) -> Result<()> {
        let client = self.nats_connection_manager.get_client().await?;
        let js = async_nats::jetstream::new((*client).clone());
        js.publish(subject.to_string(), bytes.to_vec().into())
            .await
            .context("Failed to publish to JetStream")?
            .await
            .context("Failed to receive JetStream ack")?;
        Ok(())
    }

    pub async fn publish<T: Serialize>(&self, subject: &str, payload: T) -> Result<()> {
        let json = serde_json::to_string(&payload).context("Failed to serialize NATS payload")?;

        let client = self.nats_connection_manager.get_client().await?;

        client
            .publish(subject.to_string(), json.into())
            .await
            .context("Failed to publish message to NATS")
    }
}
