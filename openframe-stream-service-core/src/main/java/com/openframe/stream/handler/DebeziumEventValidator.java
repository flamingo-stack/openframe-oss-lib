package com.openframe.stream.handler;

import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;

/**
 * Pluggable extra validation applied by {@link DebeziumKafkaMessageHandler} on
 * top of the built-in visibility check. Tenant cluster uses the default
 * pass-through impl; shared SaaS cluster supplies a validator that drops
 * events without a resolved tenantId.
 */
public interface DebeziumEventValidator {

    boolean isValid(DeserializedDebeziumMessage message);
}
