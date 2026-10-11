package com.openframe.stream.handler;

import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;

// Tenant cluster uses the default pass-through impl; shared SaaS cluster drops events without a resolved tenantId.
public interface DebeziumEventValidator {

    boolean isValid(DeserializedDebeziumMessage message);
}

