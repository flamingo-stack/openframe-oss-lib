use serde::{Deserialize, Serialize};

pub const DELIVERY_RESULT_KIND: &str = "delivery.result";
pub const CLIENT_UPDATE_DELIVERY_TYPE: &str = "CLIENT_UPDATE";

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

    pub fn new(delivery: DeliveryRef, result: DeliveryResult, error: Option<String>) -> Self {
        Self {
            delivery,
            result,
            error,
        }
    }
}

pub fn delivery_result_subject(machine_id: &str) -> String {
    format!("machine.{}.{}", machine_id, DELIVERY_RESULT_KIND)
}
