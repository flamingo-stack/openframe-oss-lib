# Event Query Filter Documentation

## Overview
The `EventQueryFilter` class is used to filter events based on various criteria such as user IDs, event types, and date ranges.

## Core Components
- **User IDs**: A list of user identifiers to filter events.
- **Event Types**: A list of event types to filter.
- **Start Date**: The beginning date for the event filtering.
- **End Date**: The ending date for the event filtering.

## Example Usage
```java
EventQueryFilter filter = EventQueryFilter.builder()
    .userIds(Arrays.asList("user1", "user2"))
    .eventTypes(Arrays.asList("LOGIN", "LOGOUT"))
    .startDate(LocalDate.now().minusDays(7))
    .endDate(LocalDate.now())
    .build();
```