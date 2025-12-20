# Deserialized Debezium Message Documentation

## Overview
The `DeserializedDebeziumMessage` class represents messages that have been deserialized from Debezium events, containing various fields related to the event.

## Core Components
- **Unified Event Type**: The type of the unified event.
- **Ingest Day**: The day the event was ingested.
- **Tool Event ID**: The identifier for the tool event.
- **Agent ID**: The identifier for the agent associated with the event.
- **Message**: The message content of the event.

## Example Usage
```java
DeserializedDebeziumMessage message = DeserializedDebeziumMessage.builder()
    .unifiedEventType(UnifiedEventType.SOME_TYPE)
    .ingestDay("2023-10-01")
    .build();
```