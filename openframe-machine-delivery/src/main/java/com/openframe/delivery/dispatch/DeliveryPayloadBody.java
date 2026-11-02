package com.openframe.delivery.dispatch;

// what a delivery carries, without the delivery block of any one row: the same body on every machine of a rollout
// or a script batch, told apart by its hash
public record DeliveryPayloadBody(String json, String hash) {
}
