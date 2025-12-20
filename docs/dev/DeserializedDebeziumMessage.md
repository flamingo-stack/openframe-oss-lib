# DeserializedDebeziumMessage Documentation

## Overview
The `DeserializedDebeziumMessage` class represents a deserialized message from Debezium, containing various event-related fields that are essential for processing events in the system.

## Core Responsibilities
- **Event Details**: Contains fields such as `unifiedEventType`, `ingestDay`, `toolEventId`, and others that describe the event.
- **Processing Control**: Fields like `skipProcessing` and `isVisible` control the processing of the message.

## Code Snippet
```java
@Data
@SuperBuilder
@NoArgsConstructor
public class DeserializedDebeziumMessage extends CommonDebeziumMessage {
    private UnifiedEventType unifiedEventType;
    private String ingestDay;
    private String toolEventId;
    private String agentId;
    private String sourceEventType;
    private String message;
    private IntegratedToolType integratedToolType;
    private String debeziumMessage;
    private String details;
    private Long eventTimestamp;
    private Boolean skipProcessing;
    private Boolean isVisible;
}
```

## Dependencies
- **CommonDebeziumMessage**: Base class for Debezium messages.