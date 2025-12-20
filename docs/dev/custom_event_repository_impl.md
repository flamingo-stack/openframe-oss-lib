# CustomEventRepositoryImpl Documentation

## Overview
The `CustomEventRepositoryImpl` class implements custom event repository functionalities, allowing for complex queries on event data.

## Core Components
- **buildEventQuery(EventQueryFilter filter, String search)**: Builds a query based on the provided filter and search criteria.
- **findEventsWithCursor(Query query, String cursor, int limit)**: Finds events with pagination support using a cursor.
- **findDistinctUserIds()**: Returns a list of distinct user IDs from the events.
- **findDistinctEventTypes()**: Returns a list of distinct event types from the events.