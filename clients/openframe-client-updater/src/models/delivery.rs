use serde::{Deserialize, Serialize};

/// Identifies one delivery-engine command; every result for it echoes this block.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryRef {
    #[serde(rename = "type")]
    pub delivery_type: String,
    pub target_id: String,
    pub dispatch_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sequence: Option<i64>,
}

/// The delivery block a delivery-engine command carries next to its payload.
#[derive(Debug, Deserialize)]
pub struct DeliveryEnvelope {
    pub delivery: DeliveryRef,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DeliveryResult {
    Acked,
    Done,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeliveryResultMessage {
    pub delivery: DeliveryRef,
    pub result: DeliveryResult,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl DeliveryResultMessage {
    pub fn acked(delivery: DeliveryRef) -> Self {
        Self::new(delivery, DeliveryResult::Acked, None)
    }

    pub fn done(delivery: DeliveryRef) -> Self {
        Self::new(delivery, DeliveryResult::Done, None)
    }

    pub fn failed(delivery: DeliveryRef, reason: impl Into<String>) -> Self {
        Self::new(delivery, DeliveryResult::Failed, Some(reason.into()))
    }

    fn new(delivery: DeliveryRef, result: DeliveryResult, error: Option<String>) -> Self {
        Self {
            delivery,
            result,
            error,
        }
    }
}

pub fn client_update_delivery_subject(machine_id: &str) -> String {
    format!("machine.{}.client-update.v2", machine_id)
}

pub fn delivery_result_subject(machine_id: &str) -> String {
    format!("machine.{}.delivery.result", machine_id)
}

#[cfg(test)]
#[path = "delivery_tests.rs"]
mod tests;
