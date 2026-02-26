# OpenFrame Data Pinot

Apache Pinot integration for OpenFrame services providing real-time analytics queries on log and device events.

## Features

- Dual connection support: broker (queries) and controller (metadata)
- Fluent query builder with SQL injection protection
- Cursor-based pagination for large result sets
- Full-text search via Pinot TEXT_MATCH
- Filter option discovery (tool types, event types, severities, organizations, date ranges)

## Configuration

```yaml
pinot:
  broker:
    url: http://localhost:8000
  controller:
    url: http://localhost:9000
```

## Key Components

### Auto-Configuration

- **PinotConfig** - Creates two Pinot connections (broker and controller) using Apache Pinot `ConnectionFactory`.

### Query Layer

- **PinotQueryBuilder** - Fluent SQL builder for Pinot queries with:
  - Parameterized `select`, `where`, `orderBy`, `groupBy`, `limit` clauses
  - Specialized filters: `whereEquals()`, `whereIn()`, `whereDateRange()`, `whereTextSearch()`, `whereCursor()`
  - Date range conversion (LocalDate to epoch millis with timezone)
  - SQL injection protection via value escaping
  - Limit validation (1-10,000 records)
- **PinotQueryException** - Custom exception for query construction and execution errors.

### Repositories

- **PinotLogRepository** / **PinotClientLogRepository** - Query logs with date range, tool types, event types, severities, organization IDs, cursor-based pagination, and sorting. Supports full-text search.
- **PinotDeviceRepository** / **PinotClientDeviceRepository** - Query device analytics data from Pinot.

### Data Model

- **PinotEventEntity** - Entity representing Pinot event records.
- **LogProjection** - DTO for log query results.
- **OrganizationOption** - DTO for organization filter options.

## Usage

Add the dependency to your service POM:

```xml
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-data-pinot</artifactId>
</dependency>
```

### Querying Logs

```java
@Service
public class LogQueryService {

    private final PinotLogRepository pinotLogRepository;

    public LogQueryService(PinotLogRepository pinotLogRepository) {
        this.pinotLogRepository = pinotLogRepository;
    }

    public List<LogProjection> queryLogs(LocalDate from, LocalDate to) {
        return pinotLogRepository.findLogs(
            from, to,
            null,   // toolTypes
            null,   // eventTypes
            null,   // severities
            null,   // organizationIds
            null,   // deviceId
            null,   // cursor
            50,     // limit
            "event_timestamp", // sortField
            "DESC"  // sortDirection
        );
    }
}
```
