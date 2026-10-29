use super::*;
use crate::models::ClientUpdateMessage;
use serde_json::json;

// The shape the backend's ClientUpdateDeliverySpec publishes on client-update.v2.
fn delivery_message() -> serde_json::Value {
    json!({
        "delivery": {
            "type": "CLIENT_UPDATE",
            "targetId": "openframe-client",
            "dispatchId": "d-1",
            "sequence": 7
        },
        "version": "1.6.2",
        "downloadConfigurations": [{
            "os": "windows",
            "fileName": "openframe-client_windows.zip",
            "targetFileName": "openframe-client.exe",
            "link": "https://tenant.example/v0/api/assets/download?agent=client&platform=windows"
        }]
    })
}

#[test]
fn a_delivery_carries_both_its_reference_and_the_update() {
    let raw = serde_json::to_vec(&delivery_message()).unwrap();

    let envelope: DeliveryEnvelope = serde_json::from_slice(&raw).unwrap();
    assert_eq!(envelope.delivery.dispatch_id, "d-1");
    assert_eq!(envelope.delivery.sequence, Some(7));

    let update: ClientUpdateMessage = serde_json::from_slice(&raw).unwrap();
    assert_eq!(update.version, "1.6.2");
    assert_eq!(update.download_configurations.len(), 1);
}

#[test]
fn results_serialize_the_way_the_backend_reads_them() {
    let delivery: DeliveryEnvelope = serde_json::from_value(delivery_message()).unwrap();

    let failed = DeliveryResultMessage::failed(delivery.delivery.clone(), "boom");
    assert_eq!(
        serde_json::to_value(&failed).unwrap(),
        json!({
            "delivery": {
                "type": "CLIENT_UPDATE",
                "targetId": "openframe-client",
                "dispatchId": "d-1",
                "sequence": 7
            },
            "result": "FAILED",
            "error": "boom"
        })
    );

    let done = serde_json::to_value(DeliveryResultMessage::done(delivery.delivery)).unwrap();
    assert_eq!(done["result"], "DONE");
    assert!(done.get("error").is_none());
}

#[test]
fn subjects_match_the_delivery_engine() {
    assert_eq!(
        client_update_delivery_subject("m-1"),
        "machine.m-1.client-update.v2"
    );
    assert_eq!(
        delivery_result_subject("m-1"),
        "machine.m-1.delivery.result"
    );
}
