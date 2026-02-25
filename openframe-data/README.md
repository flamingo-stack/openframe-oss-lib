# OpenFrame Data Library

Shared data-access logic, enums, tool SDK configuration, and cross-cutting services used by multiple OpenFrame microservices.

> **Note:** Cassandra, Apache Pinot, and NATS concerns have been extracted into dedicated modules:
> [`openframe-data-cassandra`](../openframe-data-cassandra), [`openframe-data-pinot`](../openframe-data-pinot), [`openframe-data-nats`](../openframe-data-nats).

## Purpose

- Shared enums and model types referenced across services (tool types, severity levels, event types, etc.)
- Machine tag event aspect and service for cross-cutting tag event handling
- Tool SDK configuration and command parameter resolution
- Agent registration secret retrieval (FleetMDM, TacticalRMM)
- Application configuration logging at startup

## Key Components

### Configuration
- **ToolSdkConfig** - Tool SDK integration configuration
- **ConfigurationLogger** - Logs MongoDB and Redis configuration values at application startup

### Models & Enums
- **IntegratedToolTypes** / **ToolCredentials** - Tool integration model types
- **IntegratedToolType**, **MessageType**, **Severity**, **UnifiedEventType**, **RateLimitWindow**, **Destination**, **EventHandlerType**, **DataEnrichmentServiceType** - Shared enums

### Services
- **MachineTagEventService** / **MachineTagEventServiceImpl** - Machine tag event handling
- **ToolCommandParamsResolver** - Resolves command parameters for tool installations
- **ToolAgentRegistrationSecretRetriever** - Interface for agent registration secret retrieval
  - **FleetMdmAgentRegistrationSecretRetriever** - FleetMDM implementation
  - **TacticalRmmAgentRegistrationSecretRetriever** - TacticalRMM implementation

### Aspects
- **MachineTagEventAspect** - AOP aspect for machine tag event processing

## Usage

```xml
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-data</artifactId>
</dependency>
```

For data-store-specific functionality, use the dedicated modules instead:

| Need | Module |
|------|--------|
| Cassandra repositories & config | `openframe-data-cassandra` |
| Pinot analytics queries | `openframe-data-pinot` |
| NATS messaging & publishers | `openframe-data-nats` |
| MongoDB documents & repositories | `openframe-data-mongo` |
| Redis caching & key management | `openframe-data-redis` |
| Kafka producers & consumers | `openframe-data-kafka` |
