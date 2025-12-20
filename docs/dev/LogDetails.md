# LogDetails Documentation

## Overview
The `LogDetails` class contains details about log events for auditing purposes. It includes various fields to capture event information.

## Core Responsibilities
- **Event Information**: Fields for event type, severity, user ID, and message details.

## Code Example
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogDetails {
    private String toolEventId;
    private String eventType;
}
```