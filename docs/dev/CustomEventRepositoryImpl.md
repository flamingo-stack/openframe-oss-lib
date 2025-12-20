# CustomEventRepositoryImpl Documentation

## Overview
The `CustomEventRepositoryImpl` class implements the `CustomEventRepository` interface, providing custom querying capabilities for events stored in MongoDB.

## Key Methods
- **buildEventQuery(EventQueryFilter filter, String search)**: Constructs a query based on the provided filter and search criteria.
- **findEventsWithCursor(Query query, String cursor, int limit)**: Retrieves events with pagination support using a cursor.
- **findDistinctUserIds()**: Fetches distinct user IDs from the event collection.
- **findDistinctEventTypes()**: Fetches distinct event types from the event collection.