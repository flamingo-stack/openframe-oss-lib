# OpenFrame Client Service Core

Shared core library for OpenFrame Client Service containing business logic, controllers, services, and DTOs.

## Overview

This module contains all the business logic and components for the OpenFrame Client Service, following the shared library pattern used across OpenFrame OSS. The actual Spring Boot application is in `openframe-client` service which depends on this core module.

## Architecture

This module follows the **Shared Library Architecture** pattern:
- **Business Logic**: All controllers, services, DTOs, and domain logic
- **Application Entry Point**: Separated in `openframe-client` service
- **Configuration**: Environment-specific configuration in `openframe-client`

```
openframe-client (service) → openframe-client-core (lib) → openframe-core, openframe-data-*, etc.
```

## Components

### Controllers
- **AgentAuthController**: Handles agent authentication
- **AgentController**: Manages agent operations
- **ToolAgentFileController**: Handles file operations for tool agents

### Services
- **AgentAuthService**: Authentication logic for agents
- **AgentRegistrationService**: Agent registration workflow
- **MachineStatusService**: Machine status management
- **ToolConnectionService**: Tool connection management
- **TagService**: Tag management for machines

### DTOs
- Agent registration requests/responses
- Authentication token responses
- Client creation requests
- Metrics messages

### Listeners
- **ClientConnectionListener**: Handles client connection events
- **MachineHeartbeatListener**: Processes machine heartbeat messages
- **ToolConnectionListener**: Manages tool connection events

### Aspects
- **MachineTagEventAspect**: Intercepts and publishes machine tag events

## Dependencies

This module depends on:
- `openframe-core`: Core utilities and shared models
- `openframe-data-mongo`: MongoDB data access layer
- `openframe-data`: Common data access abstractions
- `openframe-data-kafka`: Kafka messaging support
- `openframe-security-core`: Security components
- `tacticalrmm`: Tactical RMM SDK
- `fleetmdm`: Fleet MDM SDK

## Usage

To use this library in a service:

```xml
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-client-core</artifactId>
    <version>${openframe.libs.version}</version>
</dependency>
```

The service must scan the base package:

```java
@SpringBootApplication
@ComponentScan(basePackages = {
    "com.openframe.client",
    "com.openframe.data",
    "com.openframe.core",
    "com.openframe.security",
    "com.openframe.kafka.producer"
})
public class ClientApplication {
    public static void main(String[] args) {
        SpringApplication.run(ClientApplication.class, args);
    }
}
```

## Development

### Building

```bash
mvn clean install
```

### Testing

```bash
mvn test
```

## Design Patterns

This module follows OpenFrame architectural patterns:
- **Shared Library Pattern**: Reusable business logic
- **Service Layer Pattern**: Clean separation of concerns
- **DTO Pattern**: Data transfer between layers
- **Event-Driven Architecture**: Kafka-based messaging
- **AOP Pattern**: Cross-cutting concerns with aspects

## References

- [OpenFrame Architecture](https://github.com/flamingo-stack/openframe-oss)
- [API Development Patterns](/.cursor/rules/api-development-patterns.mdc)
- [Shared Library Architecture](/.cursor/rules/api-library-architecture.mdc)

