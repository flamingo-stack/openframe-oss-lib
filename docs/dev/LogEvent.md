# LogEvent Documentation

## Overview
The `LogEvent` class represents an event log entry, capturing details about events related to devices and organizations. It is used for auditing and tracking purposes within the system.

## Core Properties
- **toolEventId**: The unique identifier for the tool event.
- **eventType**: The type of event (e.g., creation, update).
- **ingestDay**: The day the event was ingested.
- **toolType**: The type of tool associated with the event.
- **severity**: The severity level of the event.
- **userId**: The ID of the user associated with the event.
- **deviceId**: The ID of the device associated with the event.
- **hostname**: The hostname of the device.
- **organizationId**: The ID of the organization associated with the event.
- **organizationName**: The name of the organization associated with the event.
- **summary**: A brief summary of the event.
- **timestamp**: The timestamp of when the event occurred.

## Example Usage
```java
LogEvent logEvent = new LogEvent();
logEvent.setToolEventId("event123");
logEvent.setEventType("UPDATE");
```