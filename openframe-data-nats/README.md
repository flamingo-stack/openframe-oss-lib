# OpenFrame Data NATS

NATS messaging integration for OpenFrame services providing tool installation orchestration and event publishing.

## Features

- Conditional activation via `spring.cloud.stream.enabled`
- Non-persistent and persistent (JetStream) message publishing
- Tool installation message building and orchestration
- Client update and tool agent update publishers
- Download configuration mapping for multi-platform assets

## Configuration

```yaml
spring:
  cloud:
    stream:
      enabled: true   # default: false, controls all NATS components
```

NATS broker configuration is handled by the Spring Cloud Stream NATS binder (`nats-spring-cloud-stream-binder`).

## Key Components

### Message Publishing

- **NatsMessagePublisher** - Core publisher with two modes:
  - `publish(subject, payload)` - Non-persistent via Spring Cloud StreamBridge
  - `publishPersistent(subject, payload)` - Persistent via NATS JetStream with JSON serialization
- All publisher beans are conditional on `spring.cloud.stream.enabled=true`.

### Tool Installation Orchestration

- **ToolInstallationService** - Orchestrates tool installation by:
  - Retrieving tool metadata from `IntegratedToolService`
  - Resolving command parameters via `ToolCommandParamsResolver`
  - Publishing installation messages via `ToolInstallationNatsPublisher`
  - Supporting both fresh installation and reinstall flows
- **ToolInstallationNatsPublisher** - Builds and publishes `ToolInstallationMessage` to topic `machine.{machineId}.tool-installation`.

### Event Publishers

- **OpenFrameClientUpdatePublisher** - Publishes client update events.
- **ToolAgentUpdateUpdatePublisher** - Publishes tool agent update events.

### Data Model

- **ToolInstallationMessage** - Installation payload containing tool metadata, download configurations, command arguments, assets, and reinstall flag.
- **ToolConnectionMessage** - Tool connection event payload.
- **InstalledAgentMessage** - Installed agent status payload.
- **OpenFrameClientUpdateMessage** - Client update event payload.
- **ToolAgentUpdateMessage** - Tool agent update event payload.
- **ClientConnectionEvent** - Client connection event payload.
- **DownloadConfiguration** / **InstallationType** - Asset download and installation type models.

### Mappers

- **DownloadConfigurationMapper** - Maps tool agent assets to download configurations.
- **LocalFilenameConfigurationMapper** - Maps local filename configurations per OS.

### Resolvers

- **DownloadConfigurationLinkResolver** - Resolves download links for asset configurations.

## Usage

Add the dependency to your service POM:

```xml
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-data-nats</artifactId>
</dependency>
```

### Publishing Messages

```java
@Service
public class MyPublisher {

    private final NatsMessagePublisher natsMessagePublisher;

    public MyPublisher(NatsMessagePublisher natsMessagePublisher) {
        this.natsMessagePublisher = natsMessagePublisher;
    }

    public void sendEvent(String subject, Object payload) {
        natsMessagePublisher.publish(subject, payload);
    }

    public void sendPersistentEvent(String subject, Object payload) {
        natsMessagePublisher.publishPersistent(subject, payload);
    }
}
```

### Tool Installation

```java
@Service
public class MyInstallationService {

    private final ToolInstallationService toolInstallationService;

    public MyInstallationService(ToolInstallationService toolInstallationService) {
        this.toolInstallationService = toolInstallationService;
    }

    public void installTool(String machineId, String toolAgentId) {
        toolInstallationService.process(machineId, toolAgentId);
    }

    public void reinstallTool(String machineId, String toolAgentId) {
        toolInstallationService.process(machineId, toolAgentId, true);
    }
}
```
