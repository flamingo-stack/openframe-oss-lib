# LogEvent Documentation

## Overview
The `LogEvent` class represents an event logged by the system. It contains various attributes that describe the event, including its type, severity, and associated user and device information.

## Core Components
- **toolEventId**: Unique identifier for the event.
- **eventType**: Type of the event (e.g., error, warning).
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