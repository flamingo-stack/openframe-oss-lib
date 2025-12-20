# EventFilters Documentation

## Overview
The `EventFilters` class is designed to define filters for events based on user IDs and event types. It provides a structured way to filter events in the system.

## Core Attributes
- `userIds`: A list of user IDs to filter events.
- `eventTypes`: A list of event types to filter events.

## Example Usage
```java
EventFilters filters = EventFilters.builder()
    .userIds(Arrays.asList("user1", "user2"))
    .eventTypes(Arrays.asList("LOGIN", "LOGOUT"))
    .build();
```

## Conclusion
The `EventFilters` class is a useful utility for managing event filtering in the system, allowing for flexible and dynamic event handling.