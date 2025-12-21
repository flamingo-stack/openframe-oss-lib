# LogDetails Documentation

## Overview
The `LogDetails` class provides detailed information about a specific log event. It extends the `LogEvent` class by adding additional fields for message and details.

## Core Components
- **toolEventId**: Unique identifier for the event.
- **eventType**: Type of the event.
- **ingestDay**: The day the event was ingested.
- **toolType**: Type of tool that generated the event.
- **severity**: Severity level of the event.
- **userId**: Identifier for the user associated with the event.
- **deviceId**: Identifier for the device associated with the event.
- **hostname**: Hostname where the event occurred.
- **organizationId**: Identifier for the organization associated with the event.
- **organizationName**: Name of the organization associated with the event.
- **summary**: Brief summary of the event.
- **timestamp**: Time when the event occurred.
- **message**: Detailed message about the event.
- **details**: Additional details about the event.