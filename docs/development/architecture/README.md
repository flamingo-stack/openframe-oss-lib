# Architecture Overview

OpenFrame OSS Libraries implements a sophisticated, multi-layered architecture designed for scalability, maintainability, and multi-tenancy. This guide provides a comprehensive understanding of the system design, core patterns, and architectural decisions.

## High-Level System Architecture

```mermaid
flowchart TD
    subgraph "Client Layer"
        Web[Web Browser]
        Mobile[Mobile Apps]
        CLI[CLI Tools]
        Agents[Client Agents]
    end
    
    subgraph "Edge Layer"
        Gateway[Gateway Service Core]
        LoadBalancer[Load Balancer]
    end
    
    subgraph "Authentication & Security"
        OAuth[Authorization Service Core]
        JWT[JWT Security Core]
        Security[Security Core]
    end
    
    subgraph "Application Layer"
        API[API Service Core]
        GraphQL[GraphQL Endpoints]
        External[External API Service Core]
        Client[Client Agent Service Core]
    end
    
    subgraph "Business Logic Layer"
        Contracts[API Lib Contracts]
        Services[Domain Services]
        Processors[Event Processors]
    end
    
    subgraph "Data Layer"
        Mongo[MongoDB]
        Redis[Redis Cache]
        Cassandra[Cassandra]
        Pinot[Apache Pinot]
    end
    
    subgraph "Event & Messaging Layer"
        Kafka[Apache Kafka]
        NATS[NATS Streaming]
        Stream[Stream Processing Core]
    end
    
    subgraph "Management & Operations"
        Management[Management Service Core]
        Monitoring[Monitoring & Metrics]
        Config[Configuration Service]
    end

    %% Connections
    Web --> LoadBalancer
    Mobile --> LoadBalancer
    CLI --> LoadBalancer
    Agents --> LoadBalancer
    
    LoadBalancer --> Gateway
    Gateway --> OAuth
    Gateway --> API
    Gateway --> External
    
    API --> Services
    GraphQL --> Services
    External --> Services
    Client --> Services
    
    Services --> Contracts
    Services --> Mongo
    Services --> Redis
    
    Stream --> Cassandra
    Stream --> Pinot
    Stream --> Kafka
    
    Management --> Mongo
    Management --> NATS
    Management --> Config
```

## Core Architectural Principles

### 1. Multi-Tenancy by Design

Every component is built with tenant isolation as a first-class concern:

- **Data Isolation**: MongoDB collections include `tenantId` fields
- **Security Context**: JWT tokens carry tenant information
- **Cache Separation**: Redis keys include tenant prefixes
- **Event Streaming**: Kafka topics are tenant-aware

```java
// Example of tenant-aware service
@Service
@RequiredArgsConstructor
public class OrganizationService {
    
    public List<Organization> findByTenant(String tenantId) {
        return repository.findByTenantId(tenantId);
    }
    
    @EventListener
    public void handleOrganizationEvent(OrganizationEvent event) {
        // Event processing is tenant-scoped
        processForTenant(event.getTenantId(), event);
    }
}
```

### 2. Event-Driven Architecture

The system embraces eventual consistency and asynchronous processing:

```mermaid
sequenceDiagram
    participant API as API Service
    participant Kafka as Kafka
    participant Stream as Stream Processor
    participant DB as Database
    participant Cache as Redis Cache
    
    API->>Kafka: Publish Event
    Kafka->>Stream: Consume Event
    Stream->>DB: Store Enriched Data
    Stream->>Cache: Update Cache
    Stream->>Kafka: Publish Derived Events
```

### 3. Domain-Driven Design (DDD)

The architecture follows DDD principles with clear bounded contexts:

| Bounded Context | Responsibility | Key Entities |
|-----------------|----------------|--------------|
| **Identity & Access** | Authentication, authorization | User, Tenant, Role |
| **Organization Management** | MSP organization data | Organization, Contact |
| **Device Management** | Endpoint devices | Machine, Device, Agent |
| **Tool Integration** | External tool connections | Tool, Connection, Credential |
| **Event Processing** | Audit logs, analytics | Event, Log, Metric |
| **Agent Management** | Client agent lifecycle | Agent, Registration, Heartbeat |

### 4. Layered Architecture

Each service follows a consistent layered approach:

```mermaid
flowchart TD
    Controller[Controllers/GraphQL] --> Service[Service Layer]
    Service --> Repository[Repository Layer]
    Repository --> Data[(Database)]
    
    Service --> Event[Event Publishers]
    Event --> Messaging[(Message Broker)]
    
    Service --> Cache[Cache Layer]
    Cache --> Redis[(Redis)]
```

## Core Components Deep Dive

### API Service Core

**Purpose**: Main application orchestration layer

**Key Responsibilities**:
- REST controller endpoints
- GraphQL schema implementation
- Request validation and mapping
- Security context management

**Technology Stack**:
- Spring Boot 3.3.0
- Spring Security OAuth2 Resource Server
- Netflix DGS for GraphQL
- Spring Data MongoDB

**Example Controller Pattern**:
```java
@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
@Validated
public class OrganizationController {
    
    private final OrganizationService service;
    
    @GetMapping
    public ResponseEntity<Page<Organization>> list(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestParam(defaultValue = "0") int page
    ) {
        String tenantId = principal.getTenantId();
        Page<Organization> organizations = service.findByTenant(tenantId, page);
        return ResponseEntity.ok(organizations);
    }
}
```

### Authorization Service Core

**Purpose**: Multi-tenant OAuth2/OIDC authorization server

**Key Features**:
- Per-tenant RSA key pairs
- Dynamic client registration
- SSO provider integration (Google, Microsoft)
- Custom user flows and invitation handling

**Architecture Pattern**:
```mermaid
flowchart LR
    subgraph "Authorization Flow"
        Client[Client Application] --> AuthZ[Authorization Endpoint]
        AuthZ --> Login[Login Handler]
        Login --> UserAuth[User Authentication]
        UserAuth --> Consent[Consent Screen]
        Consent --> Token[Token Endpoint]
        Token --> JWT[JWT Token]
    end
    
    subgraph "Multi-Tenant Support"
        JWT --> KeyService[Tenant Key Service]
        KeyService --> TenantKeys[(Per-Tenant Keys)]
    end
```

### Gateway Service Core

**Purpose**: Reactive edge gateway with authentication and routing

**Key Features**:
- JWT validation with multi-issuer support
- API key authentication
- Rate limiting per tenant
- WebSocket proxy support
- CORS handling

**Request Flow**:
```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Auth as Auth Service
    participant Backend as Backend Service
    
    Client->>Gateway: Request with JWT
    Gateway->>Auth: Validate JWT
    Auth-->>Gateway: Valid + Claims
    Gateway->>Backend: Forward Request
    Backend-->>Gateway: Response
    Gateway-->>Client: Response
```

### Stream Processing Service Core

**Purpose**: Real-time event processing and data enrichment

**Processing Pipeline**:
```mermaid
flowchart LR
    subgraph "Ingestion"
        External[External Tool] --> CDC[CDC Connector]
        CDC --> RawEvents[Raw Events Topic]
    end
    
    subgraph "Processing"
        RawEvents --> Deserializer[Event Deserializer]
        Deserializer --> Enricher[Data Enricher]
        Enricher --> Normalizer[Event Normalizer]
    end
    
    subgraph "Storage"
        Normalizer --> Analytics[Analytics Store]
        Normalizer --> Operational[Operational Store]
        Normalizer --> Cache[Cache Update]
    end
```

### Data Platform Core

**Purpose**: Multi-database coordination and analytics

**Data Architecture**:

| Database | Purpose | Data Types |
|----------|---------|------------|
| **MongoDB** | Operational data | Users, organizations, configurations |
| **Cassandra** | Time-series data | Audit logs, metrics, events |
| **Apache Pinot** | Real-time analytics | Aggregated metrics, dashboards |
| **Redis** | Caching & sessions | Cache entries, rate limits, locks |

### Client Agent Service Core

**Purpose**: Endpoint agent lifecycle and communication

**Agent Communication Flow**:
```mermaid
sequenceDiagram
    participant Agent as Client Agent
    participant HTTP as HTTP API
    participant NATS as NATS Streams
    participant Service as Agent Service
    participant DB as Database
    
    Agent->>HTTP: Register Agent
    HTTP->>Service: Process Registration
    Service->>DB: Store Agent Info
    
    loop Heartbeat & Events
        Agent->>NATS: Publish Heartbeat
        NATS->>Service: Process Heartbeat
        Service->>DB: Update Status
    end
```

## Data Flow Patterns

### 1. Read Path (Query Operations)

```mermaid
flowchart LR
    Client[Client Request] --> Gateway[Gateway]
    Gateway --> API[API Service]
    API --> Cache{Redis Cache Hit?}
    Cache -->|Hit| Return[Return Cached Data]
    Cache -->|Miss| DB[MongoDB Query]
    DB --> Enrich[Enrich Data]
    Enrich --> UpdateCache[Update Cache]
    UpdateCache --> Return
```

### 2. Write Path (Command Operations)

```mermaid
flowchart LR
    Client[Client Request] --> Gateway[Gateway]
    Gateway --> API[API Service]
    API --> Validate[Validate & Transform]
    Validate --> DB[MongoDB Write]
    DB --> Event[Publish Event]
    Event --> Kafka[Kafka Topic]
    Kafka --> Stream[Stream Processor]
    Stream --> Analytics[Update Analytics]
    Stream --> Cache[Invalidate Cache]
```

### 3. Event Processing Path

```mermaid
flowchart TD
    Source[Event Source] --> Kafka[Kafka Topic]
    Kafka --> Consumer[Event Consumer]
    Consumer --> Deserialize[Deserialize Event]
    Deserialize --> Enrich[Enrich with Context]
    Enrich --> Transform[Transform Data]
    Transform --> Multiple{Multiple Destinations}
    
    Multiple --> Cassandra[Audit Storage]
    Multiple --> Pinot[Analytics Storage]
    Multiple --> MongoDB[Operational Update]
    Multiple --> Redis[Cache Update]
    Multiple --> Derived[Derived Events]
```

## Security Architecture

### Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant User as End User
    participant App as Client App
    participant Gateway as Gateway
    participant Auth as Auth Service
    participant Resource as Resource Service
    
    User->>App: Login Request
    App->>Auth: OAuth2 Authorization
    Auth->>User: Login Form
    User->>Auth: Credentials
    Auth->>App: Authorization Code
    App->>Auth: Exchange for Token
    Auth-->>App: JWT Token
    
    App->>Gateway: API Request + JWT
    Gateway->>Auth: Validate JWT
    Auth-->>Gateway: Valid + Claims
    Gateway->>Resource: Forward Request
    Resource-->>Gateway: Response
    Gateway-->>App: Response
```

### Multi-Tenant Security Model

```mermaid
flowchart TD
    subgraph "Tenant A"
        UserA[Users A] --> DataA[Data A]
        KeysA[RSA Keys A] --> JWTA[JWT Tokens A]
    end
    
    subgraph "Tenant B"
        UserB[Users B] --> DataB[Data B]
        KeysB[RSA Keys B] --> JWTB[JWT Tokens B]
    end
    
    subgraph "Shared Infrastructure"
        Gateway[Gateway Service]
        Auth[Auth Service]
        DB[(Multi-Tenant Database)]
    end
    
    JWTA --> Gateway
    JWTB --> Gateway
    Gateway --> Auth
    Auth --> DB
```

## Performance & Scalability Patterns

### 1. Caching Strategy

```mermaid
flowchart LR
    Request[API Request] --> L1[Application Cache]
    L1 -->|Miss| L2[Redis Cache]
    L2 -->|Miss| DB[Database]
    
    DB --> Populate[Populate Caches]
    Populate --> L2
    Populate --> L1
```

**Cache Levels**:
- **L1 (Application)**: In-memory cache for hot data
- **L2 (Redis)**: Distributed cache for shared data
- **CDN**: Static assets and public content

### 2. Database Sharding

```mermaid
flowchart TD
    App[Application] --> Router[Tenant Router]
    Router -->|Tenant A-M| Shard1[MongoDB Shard 1]
    Router -->|Tenant N-Z| Shard2[MongoDB Shard 2]
    Router -->|Analytics| Pinot[Apache Pinot]
    Router -->|Audit Logs| Cassandra[Cassandra]
```

### 3. Event Stream Partitioning

```mermaid
flowchart LR
    Producer[Event Producer] --> Kafka[Kafka Topic]
    Kafka -->|Partition 0| Consumer1[Consumer Group 1]
    Kafka -->|Partition 1| Consumer2[Consumer Group 2]
    Kafka -->|Partition 2| Consumer3[Consumer Group 3]
    
    subgraph "Partitioning Strategy"
        TenantID[Tenant ID Hash]
        EventType[Event Type]
        Timestamp[Time-based]
    end
```

## Monitoring & Observability

### Metrics Collection

```mermaid
flowchart TD
    App[Application] --> Micrometer[Micrometer Metrics]
    Micrometer --> Prometheus[Prometheus]
    Prometheus --> Grafana[Grafana Dashboards]
    
    App --> Logging[Structured Logging]
    Logging --> ELK[ELK Stack]
    
    App --> Tracing[Distributed Tracing]
    Tracing --> Jaeger[Jaeger]
```

### Key Metrics

| Metric Type | Examples | Purpose |
|-------------|----------|---------|
| **Business** | Organizations created, Devices connected | Feature usage |
| **Application** | Request latency, Error rates | Performance |
| **Infrastructure** | CPU, Memory, Database connections | Resource utilization |
| **Security** | Failed logins, JWT validations | Security monitoring |

## Deployment Architecture

### Container Strategy

```mermaid
flowchart TD
    subgraph "Service Layer"
        Gateway[Gateway Container]
        API[API Service Container]
        Auth[Auth Service Container]
        Stream[Stream Processor Container]
    end
    
    subgraph "Data Layer"
        MongoDB[MongoDB Cluster]
        Redis[Redis Cluster]
        Kafka[Kafka Cluster]
        Cassandra[Cassandra Cluster]
    end
    
    subgraph "Infrastructure"
        LB[Load Balancer]
        DNS[Service Discovery]
        Config[Config Server]
    end
```

### Scaling Patterns

```mermaid
flowchart LR
    subgraph "Horizontal Scaling"
        LB[Load Balancer] --> Instance1[Instance 1]
        LB --> Instance2[Instance 2]
        LB --> Instance3[Instance 3]
    end
    
    subgraph "Data Scaling"
        App[Application] --> ReadReplicas[Read Replicas]
        App --> WriteLeader[Write Leader]
        App --> Cache[Distributed Cache]
    end
```

## Design Patterns & Best Practices

### 1. Command Query Responsibility Segregation (CQRS)

```java
// Command side - writes
@Component
public class OrganizationCommandService {
    public void createOrganization(CreateOrganizationCommand command) {
        // Validation and business logic
        Organization org = new Organization(command);
        repository.save(org);
        publisher.publishEvent(new OrganizationCreatedEvent(org));
    }
}

// Query side - reads
@Component 
public class OrganizationQueryService {
    public List<Organization> findByTenant(String tenantId) {
        return queryRepository.findByTenantId(tenantId);
    }
}
```

### 2. Event Sourcing Pattern

```java
@EventHandler
public class OrganizationEventHandler {
    
    @EventListener
    public void on(OrganizationCreatedEvent event) {
        // Update read models
        updateOrganizationView(event);
        updateTenantStatistics(event);
        sendWelcomeNotification(event);
    }
}
```

### 3. Saga Pattern for Distributed Transactions

```java
@Component
public class UserRegistrationSaga {
    
    @SagaOrchestrationStart
    public void startRegistration(UserRegistrationCommand command) {
        // Step 1: Create user
        send(new CreateUserCommand(command));
    }
    
    @SagaOrchestrationStep
    public void onUserCreated(UserCreatedEvent event) {
        // Step 2: Send invitation email
        send(new SendInvitationEmailCommand(event));
    }
    
    // Compensation logic for failures
    @SagaOrchestrationRollback
    public void rollbackUserCreation(UserCreationFailedEvent event) {
        send(new DeleteUserCommand(event.getUserId()));
    }
}
```

## Next Steps

Now that you understand the architecture:

1. **[Security Guidelines](../security/README.md)** - Implement secure, tenant-aware features
2. **[Testing Overview](../testing/README.md)** - Test architectural components effectively
3. **[Contributing Guidelines](../contributing/guidelines.md)** - Follow architectural patterns when contributing

## Additional Resources

- **[API Reference](../../reference/architecture/)** - Detailed module documentation
- **[Spring Boot Architecture Guide](https://spring.io/guides/gs/spring-boot/)**
- **[Microservices Patterns](https://microservices.io/patterns/)**
- **[Domain-Driven Design Reference](https://domainlanguage.com/ddd/reference/)**

---

*This architecture enables OpenFrame OSS Libraries to scale from single-tenant deployments to massive multi-tenant SaaS platforms while maintaining security, performance, and maintainability.*