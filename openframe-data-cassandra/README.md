# OpenFrame Data Cassandra

Cassandra integration for OpenFrame services with auto-configuration, health monitoring, and unified log event storage.

## Features

- Conditional activation via `spring.data.cassandra.enabled`
- Auto-creation of keyspace with configurable replication factor
- Automatic keyspace name normalization (dashes to underscores for tenant IDs)
- Health indicator for Cassandra connectivity
- Unified log event model optimized for time-series queries

## Configuration

```yaml
spring:
  data:
    cassandra:
      enabled: true                # default: false
      contact-points: localhost
      port: 9042
      local-datacenter: datacenter1
      keyspace-name: my-tenant     # dashes auto-converted to underscores
      replication-factor: 1        # default: 1
```

## Key Components

### Auto-Configuration

- **CassandraConfig** - Configures connection, session, and repository scanning. Enabled when `spring.data.cassandra.enabled=true`. Auto-creates keyspace before session initialization.
- **CassandraKeyspaceNormalizer** - `ApplicationContextInitializer` registered via `spring.factories`. Normalizes keyspace names by replacing dashes with underscores (Cassandra naming constraint), allowing tenant IDs with dashes.

### Health Monitoring

- **CassandraHealthIndicator** - Spring Boot health indicator that queries `system.local` to verify connectivity. Enabled by default when Cassandra is active.

### Data Model

- **UnifiedLogEvent** - Stored in `unified_logs` table with composite primary key: `ingest_day` + `tool_type` (partition), `event_type` + `event_timestamp` + `tool_event_id` (clustering). Optimized for time-series queries by day and tool type.
- **UnifiedLogEventRepository** - Spring Data Cassandra repository for CRUD operations on unified log events.

## Usage

Add the dependency to your service POM:

```xml
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-data-cassandra</artifactId>
</dependency>
```

The module auto-configures when `spring.data.cassandra.enabled=true`. No additional setup is needed beyond configuration properties.

### Exclude Filter

Services that include this module on the classpath but do not use Cassandra can exclude the health indicator via `@ComponentScan` exclude filters on `CassandraHealthIndicator.class`.
