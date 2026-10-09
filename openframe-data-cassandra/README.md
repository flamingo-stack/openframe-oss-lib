# OpenFrame Data Cassandra

Cassandra integration for OpenFrame services with auto-configuration, health monitoring, and RMM command result storage.

## Features

- Conditional activation via `spring.data.cassandra.enabled`
- Auto-creation of keyspace with configurable replication factor
- Automatic keyspace name normalization (dashes to underscores for tenant IDs)
- Health indicator for Cassandra connectivity
- RMM command result model keyed by execution and machine

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

- **CommandResult** - Stored in `command_results` table with primary key: `execution_id` (partition), `machine_id` (clustering).
- **CommandResultRepository** - Spring Data Cassandra repository for RMM command results.

Tool event details (the former `unified_logs` table) live in Loki: see `ToolEventLogRepository` in `openframe-data-loki`.

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
