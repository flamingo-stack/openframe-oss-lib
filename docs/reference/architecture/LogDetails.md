# LogDetails Sub-Module Documentation

## Overview
The `LogDetails` sub-module is part of the auditing DTOs in the OpenFrame API library. It encapsulates detailed information about log events, providing essential metadata for auditing purposes.

## Core Functionality
- **Tool Event ID**: Unique identifier for the tool event.
- **Event Type**: Type of the event (e.g., error, info).
- **Severity**: Level of severity of the event.
- **Timestamp**: The exact time when the event occurred.
- **Message**: Detailed message describing the event.

## Key Fields
- `toolEventId`: String
- `eventType`: String
- `severity`: String
- `timestamp`: Instant
- `message`: String

## Usage
This DTO is used to capture and store detailed log information, which can be queried and filtered using the `LogFilterOptions` sub-module.

---
For more information on related components, refer to the [Module 1 Documentation](module_1.md).