package com.openframe.stream.processor;

import com.openframe.data.model.enums.MessageType;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;

/**
 * Read-only extension point for services that need the deserialized and enriched event without
 * owning a destination. Implementations receive every message type and filter for their own.
 */
public interface ProcessedMessageObserver {

    void onProcessed(MessageType type, DeserializedDebeziumMessage message, IntegratedToolEnrichedData enrichedData);
}
