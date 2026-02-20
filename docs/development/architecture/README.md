# Architecture Overview

OpenFrame OSS Lib implements a sophisticated, modular architecture designed for enterprise-scale MSP platforms. This guide explores the architectural patterns, design decisions, and component relationships that make the system scalable, maintainable, and extensible.

[![OpenFrame v0.5.2: Autonomous AI Agent Architecture for MSPs](https://img.youtube.com/vi/PexpoNdZtUk/maxresdefault.jpg)](https://www.youtube.com/watch?v=PexpoNdZtUk)

## High-Level System Architecture

OpenFrame OSS Lib follows a layered, event-driven architecture with clear separation of concerns:

```mermaid
flowchart TD
    subgraph "Client Layer"
        WebUI["`**Web UI**
        Admin Dashboard`"]
        Mobile["`**Mobile Apps**
        Technician Apps`"]
        Agents["`**Client Agents**
        Device Monitoring`"]
        ExtAPI["`**External APIs**
        Third-party Integration`"]
    end

    subgraph "Edge Layer"
        Gateway["`**Gateway Service**
        • Routing & Load Balancing
        • JWT Validation
        • Rate Limiting
        • WebSocket Proxy`"]
        CDN["`**CDN/Static Assets**
        Asset Distribution`"]
    end

    subgraph "Security & Identity"
        AuthZ["`**Authorization Server**
        • Multi-tenant OAuth2
        • SSO Integration
        • JWT Issuance
        • User Management`"]
        OAuth["`**OAuth BFF**
        • PKCE Flow
        • Cookie Management  
        • Dev Ticket Exchange`"]
    end

    subgraph "API Layer" 
        APICore["`**API Service Core**
        • Internal REST APIs
        • GraphQL (DGS)
        • Business Logic
        • DTO Mapping`"]
        ExtAPICore["`**External API Service**
        • Public REST APIs
        • API Key Auth
        • Rate Limited
        • Versioned`"]
        Contracts["`**API Lib Contracts**
        • Shared DTOs
        • Filter Models
        • Mappers`"]
    end

    subgraph "Business Services"
        Client["`**Client Service Core**
        • Agent Registration
        • Heartbeat Processing  
        • Tool Communication`"]
        Management["`**Management Service**
        • Platform Operations
        • Configuration
        • Monitoring`"]
        Stream["`**Stream Processing**
        • Event Processing
        • Real-time Analytics
        • Data Enrichment`"]
    end

    subgraph "Data Layer"
        MongoDB["`**MongoDB**
        • Operational Data
        • User/Tenant Info
        • Configuration`"]
        Redis["`**Redis Cache**
        • Session Storage
        • API Rate Limits
        • Temporary Data`"]
        Cassandra["`**Cassandra**
        • Time-series Data
        • Audit Logs
        • Event History`"]
        Pinot["`**Apache Pinot**
        • Real-time Analytics
        • OLAP Queries
        • Dashboards`"]
    end

    subgraph "Messaging & Events"
        Kafka["`**Apache Kafka**
        • Event Streaming
        • Service Integration
        • Data Pipeline`"]
        NATS["`**NATS JetStream**
        • Agent Communication
        • Real-time Updates
        • Pub/Sub`"]
    end

    subgraph "External Integrations"
        FleetMDM["`**Fleet MDM**
        Device Management`"]
        TacticalRMM["`**Tactical RMM**
        Remote Monitoring`"]
        MeshCentral["`**MeshCentral**
        Remote Access`"]
    end

    %% Client connections
    WebUI --> Gateway
    Mobile --> Gateway
    Agents --> Client
    ExtAPI --> Gateway

    %% Edge routing
    Gateway --> APICore
    Gateway --> ExtAPICore
    Gateway --> AuthZ

    %% Authentication flows
    WebUI --> OAuth
    OAuth --> AuthZ

    %% API relationships
    APICore --> Contracts
    ExtAPICore --> Contracts
    
    %% Service connections
    APICore --> MongoDB
    APICore --> Redis
    APICore --> Kafka
    
    Client --> MongoDB
    Client --> NATS
    Client --> FleetMDM
    Client --> TacticalRMM
    Client --> MeshCentral

    Management --> MongoDB
    Management --> Kafka
    Management --> Pinot

    Stream --> Kafka
    Stream --> Cassandra
    Stream --> Pinot
```

## Core Architectural Principles

### 1. Multi-Tenancy by Design

Every component is built with tenant isolation as a first-class concern:

```mermaid
flowchart LR
    subgraph "Request Processing"
        Request["`**HTTP Request**`"]
        TenantResolver["`**Tenant Resolver**
        • Domain-based
        • JWT claims
        • API key scope`"]
        Context["`**Tenant Context**
        ThreadLocal isolation`"]
    end

    subgraph "Data Isolation"
        MongoFilter["`**MongoDB Filter**
        tenant_id: 'tenant-1'`"]
        RedisPrefix["`**Redis Prefix**
        tenant:tenant-1:key`"]
        KafkaTopic["`**Kafka Topics**
        tenant-1-events`"]
    end

    Request --> TenantResolver
    TenantResolver --> Context
    Context --> MongoFilter
    Context --> RedisPrefix
    Context --> KafkaTopic
```

### 2. Event-Driven Architecture

Services communicate through events rather than direct coupling:

```mermaid
sequenceDiagram
    participant Agent as Device Agent
    participant Client as Client Service
    participant Kafka as Event Stream
    participant Stream as Stream Processor
    participant Analytics as Analytics DB
    participant API as API Service

    Agent->>Client: Device Heartbeat
    Client->>Kafka: DeviceStatusChanged Event
    Client->>MongoDB: Update Device Record
    
    Kafka->>Stream: Process Event
    Stream->>Analytics: Store Time-series Data
    Stream->>Kafka: Enriched Analytics Event
    
    Kafka->>API: Analytics Update
    API->>WebSocket: Real-time Update to UI
```

### 3. Clean Module Boundaries

Each module has a single responsibility and well-defined interfaces:

```mermaid
flowchart TD
    subgraph "Module Dependencies"
        Core["`**openframe-core**
        Shared utilities`"]
        
        Security["`**openframe-security-core**  
        JWT, auth utilities`"]
        
        DataMongo["`**openframe-data-mongo**
        Domain models, repos`"]
        
        DataRedis["`**openframe-data-redis**
        Cache infrastructure`"]
        
        APILib["`**openframe-api-lib**
        API contracts`"]
        
        APICore["`**openframe-api-service-core**
        REST & GraphQL APIs`"]
        
        Gateway["`**openframe-gateway-service-core**
        Edge routing`"]
    end

    Core --> Security
    Core --> DataMongo
    Core --> DataRedis
    
    Security --> APICore
    DataMongo --> APILib
    APILib --> APICore
    
    Security --> Gateway
    APICore --> Gateway
```

## Detailed Component Architecture

### Security & Authentication Layer

The security layer implements OAuth2 with multi-tenant support:

```mermaid
flowchart TD
    subgraph "Authentication Flow"
        Browser["`**Browser Client**`"]
        BFF["`**OAuth BFF**
        Backend-for-Frontend`"]
        AuthServer["`**Authorization Server**
        Multi-tenant OAuth2`"]
        ResourceServer["`**Resource Server**
        API Services`"]
    end

    subgraph "Token Management"
        JWTIssuer["`**JWT Issuer**
        Per-tenant keys`"]
        JWTValidator["`**JWT Validator**  
        Multi-issuer support`"]
        APIKeys["`**API Key Service**
        External auth`"]
    end

    subgraph "User Store"
        UserMgmt["`**User Management**
        Registration, invites`"]
        TenantMgmt["`**Tenant Management**
        Org isolation`"]
        SSOConfig["`**SSO Configuration**
        Google, Microsoft`"]
    end

    Browser -->|"1. Auth Request"| BFF
    BFF -->|"2. OAuth Flow"| AuthServer
    AuthServer -->|"3. Issue JWT"| JWTIssuer
    JWTIssuer -->|"4. Signed Token"| Browser
    
    Browser -->|"5. API Request + JWT"| ResourceServer
    ResourceServer -->|"6. Validate"| JWTValidator
    
    AuthServer --> UserMgmt
    AuthServer --> TenantMgmt
    AuthServer --> SSOConfig
```

### API Layer Architecture

The API layer provides both internal and external interfaces:

```mermaid
flowchart LR
    subgraph "API Gateway Layer"
        Gateway["`**Spring Cloud Gateway**
        • Route filtering
        • Load balancing
        • Circuit breaker
        • Rate limiting`"]
    end

    subgraph "Internal APIs"
        APIService["`**API Service Core**
        • REST Controllers
        • GraphQL DataFetchers
        • Business Logic
        • Admin Operations`"]
        
        GraphQL["`**GraphQL Layer**
        • Netflix DGS
        • DataLoaders
        • Federation
        • Schema evolution`"]
    end

    subgraph "External APIs"
        ExternalAPI["`**External API Service**
        • Versioned REST API
        • API key authentication
        • Public documentation
        • Rate limiting`"]
        
        Webhooks["`**Webhook Support**
        • Event delivery
        • Retry logic
        • Signature verification`"]
    end

    subgraph "Shared Contracts"
        DTOs["`**API Lib Contracts**
        • Request/Response DTOs
        • Filter specifications  
        • Mapping interfaces
        • Validation rules`"]
    end

    Gateway --> APIService
    Gateway --> ExternalAPI
    
    APIService --> GraphQL
    APIService --> DTOs
    ExternalAPI --> DTOs
    ExternalAPI --> Webhooks
```

### Data Architecture

OpenFrame uses a polyglot persistence approach:

```mermaid
flowchart TD
    subgraph "Application Layer"
        Services["`**Application Services**`"]
    end

    subgraph "Data Access Layer"
        MongoRepos["`**MongoDB Repositories**
        • Spring Data MongoDB
        • Custom queries
        • Reactive support
        • Multi-tenant filtering`"]
        
        RedisOps["`**Redis Operations**
        • Cache Manager
        • Session Store
        • Rate Limit Store
        • Reactive Templates`"]
        
        KafkaProducer["`**Kafka Producers**
        • Event publishing
        • Transactional
        • Tenant-aware topics`"]
    end

    subgraph "Storage Layer"
        MongoDB["`**MongoDB**
        **Operational Data**
        • Users, tenants
        • Devices, organizations
        • Configurations
        • OAuth clients`"]
        
        Redis["`**Redis Cache**
        **Fast Access Data**
        • User sessions
        • API rate limits
        • Cached queries
        • Temporary data`"]
        
        Cassandra["`**Cassandra**
        **Time-Series Data**
        • Device logs
        • Audit events
        • System metrics
        • Long-term storage`"]
        
        Pinot["`**Apache Pinot**
        **Real-Time Analytics**
        • Dashboard queries
        • Aggregated metrics
        • OLAP workloads`"]
    end

    subgraph "Event Stream"
        Kafka["`**Apache Kafka**
        **Event Pipeline**
        • Change data capture
        • Event sourcing
        • Service integration
        • Stream processing`"]
    end

    Services --> MongoRepos
    Services --> RedisOps
    Services --> KafkaProducer
    
    MongoRepos --> MongoDB
    RedisOps --> Redis
    KafkaProducer --> Kafka
    
    Kafka --> Cassandra
    Kafka --> Pinot
```

## Integration Patterns

### Agent Communication Architecture

Client agents communicate with the platform through multiple channels:

```mermaid
sequenceDiagram
    participant Agent as OpenFrame Agent
    participant ClientService as Client Service
    participant NATS as NATS JetStream
    participant API as API Service
    participant Tools as External Tools

    Note over Agent, Tools: Agent Registration
    Agent->>ClientService: Register with secret
    ClientService->>API: Validate registration
    API-->>ClientService: Registration approved
    ClientService-->>Agent: Agent credentials

    Note over Agent, Tools: Real-time Communication  
    Agent->>NATS: Subscribe to commands
    ClientService->>NATS: Publish agent command
    NATS->>Agent: Deliver command
    Agent->>NATS: Command response
    NATS->>ClientService: Response delivered

    Note over Agent, Tools: Tool Integration
    Agent->>Tools: Query device status
    Tools-->>Agent: Device data
    Agent->>ClientService: Report device status
    ClientService->>API: Update device records
```

### External Tool Integration

OpenFrame connects with existing MSP tools through standardized SDKs:

```mermaid
flowchart LR
    subgraph "OpenFrame Core"
        ClientService["`**Client Service**
        Agent management`"]
        ToolService["`**Tool Service**
        Integration logic`"]
        DataSync["`**Data Sync**
        Bidirectional sync`"]
    end

    subgraph "Tool SDKs"
        FleetSDK["`**Fleet MDM SDK**
        • Host queries
        • Script execution
        • Policy management`"]
        
        TacticalSDK["`**Tactical RMM SDK**  
        • Agent management
        • Script execution
        • Monitoring data`"]
        
        MeshSDK["`**MeshCentral SDK**
        • Remote access
        • File operations
        • Session management`"]
    end

    subgraph "External Tools"
        Fleet["`**Fleet MDM**
        Device management`"]
        Tactical["`**Tactical RMM**
        RMM platform`"]
        Mesh["`**MeshCentral**
        Remote access`"]
    end

    ClientService --> ToolService
    ToolService --> DataSync
    
    ToolService --> FleetSDK
    ToolService --> TacticalSDK
    ToolService --> MeshSDK
    
    FleetSDK --> Fleet
    TacticalSDK --> Tactical
    MeshSDK --> Mesh
```

## Key Design Patterns

### 1. Repository Pattern with Multi-Tenancy

```java
// Example: Tenant-aware repository
@Repository
public interface DeviceRepository extends MongoRepository<Device, String> {
    
    // Automatic tenant filtering through custom implementation
    List<Device> findByOrganizationId(String organizationId);
    
    // Custom query with tenant context
    @Query("{ 'tenantId': ?#{principal.tenantId}, 'status': ?0 }")
    List<Device> findByStatus(DeviceStatus status);
    
    // Reactive support for high-throughput operations  
    Flux<Device> findByTenantIdAndLastSeenAfter(String tenantId, Instant since);
}
```

### 2. Event Publishing Pattern

```java
// Example: Domain event publishing
@Service  
@RequiredArgsConstructor
public class DeviceService {
    
    private final DeviceRepository deviceRepository;
    private final ApplicationEventPublisher eventPublisher;
    
    public Device updateDeviceStatus(String deviceId, DeviceStatus status) {
        Device device = deviceRepository.findById(deviceId)
            .orElseThrow(() -> new DeviceNotFoundException(deviceId));
            
        DeviceStatus oldStatus = device.getStatus();
        device.setStatus(status);
        device = deviceRepository.save(device);
        
        // Publish domain event
        eventPublisher.publishEvent(new DeviceStatusChangedEvent(
            device.getId(), oldStatus, status, device.getTenantId()));
            
        return device;
    }
}
```

### 3. GraphQL DataLoader Pattern

```java
// Example: Efficient batch loading
@DgsDataLoader(name = "organizationLoader")
public class OrganizationDataLoader implements BatchLoader<String, Organization> {
    
    private final OrganizationService organizationService;
    
    @Override
    public CompletionStage<List<Organization>> load(List<String> organizationIds) {
        return CompletableFuture.supplyAsync(() -> 
            organizationService.findByIds(organizationIds));
    }
}
```

## Performance & Scalability Patterns

### 1. Caching Strategy

```mermaid
flowchart LR
    subgraph "Cache Hierarchy"  
        L1["`**L1 Cache**
        Application Cache
        (Caffeine)`"]
        
        L2["`**L2 Cache**
        Redis Cache
        (Distributed)`"]
        
        DB["`**Database**
        MongoDB
        (Source of Truth)`"]
    end

    Request["`**API Request**`"] --> L1
    L1 -->|Cache Miss| L2
    L2 -->|Cache Miss| DB
    
    DB -->|Write Through| L2
    L2 -->|Async Refresh| L1
```

### 2. Event Stream Processing

```mermaid
flowchart TD
    subgraph "Event Sources"
        API["`**API Changes**`"]
        Agents["`**Agent Reports**`"]  
        Tools["`**Tool Events**`"]
    end

    subgraph "Event Stream"
        Kafka["`**Kafka Topics**
        • Raw events
        • Partitioned by tenant
        • Ordered delivery`"]
    end

    subgraph "Stream Processing"
        Processor["`**Stream Processor**
        • Event enrichment
        • Aggregation
        • Filtering
        • Transformation`"]
    end

    subgraph "Event Sinks"
        Analytics["`**Analytics DB**
        Time-series data`"]
        
        Search["`**Search Index**
        Full-text search`"]
        
        Notifications["`**Notifications**
        Real-time alerts`"]
    end

    API --> Kafka
    Agents --> Kafka
    Tools --> Kafka
    
    Kafka --> Processor
    
    Processor --> Analytics
    Processor --> Search
    Processor --> Notifications
```

## Security Architecture Deep Dive

### Multi-Tenant JWT Validation

```mermaid
flowchart TD
    subgraph "JWT Processing Pipeline"
        Request["`**Incoming Request**
        Authorization: Bearer JWT`"]
        
        Extractor["`**JWT Extractor**
        Extract from header`"]
        
        Resolver["`**Issuer Resolver**  
        Determine tenant issuer`"]
        
        Validator["`**JWT Validator**
        Verify signature & claims`"]
        
        Context["`**Security Context**
        AuthPrincipal with tenant`"]
    end

    subgraph "Tenant Key Management"
        KeyCache["`**Key Cache**
        Per-tenant public keys`"]
        
        KeyRotation["`**Key Rotation**
        Automatic key refresh`"]
    end

    Request --> Extractor
    Extractor --> Resolver
    Resolver --> KeyCache
    KeyCache --> Validator
    Validator --> Context
    
    KeyRotation --> KeyCache
```

## Testing Architecture

OpenFrame implements comprehensive testing at multiple levels:

```mermaid
flowchart TD
    subgraph "Test Pyramid"
        Unit["`**Unit Tests**
        • Service logic
        • Utility functions
        • Domain models
        • Mock dependencies`"]
        
        Integration["`**Integration Tests**
        • Repository tests
        • Service integration
        • API contract tests
        • Database tests`"]
        
        E2E["`**End-to-End Tests**
        • Full workflow tests
        • Multi-service scenarios
        • Real database tests
        • Authentication flows`"]
    end

    subgraph "Test Infrastructure"
        TestContainers["`**TestContainers**
        • MongoDB containers
        • Redis containers
        • Kafka containers
        • Isolated test env`"]
        
        Mocks["`**Mocking Framework**
        • Mockito
        • WireMock
        • Test doubles`"]
        
        TestData["`**Test Data Builder**
        • Domain fixtures
        • Test scenarios
        • Data generators`"]
    end

    Unit --> Integration
    Integration --> E2E
    
    Integration --> TestContainers
    Unit --> Mocks
    Integration --> TestData
```

## Deployment Architecture

While OpenFrame OSS Lib is a library collection, understanding deployment patterns helps with integration:

```mermaid
flowchart TD
    subgraph "Deployment Options"
        Monolith["`**Modular Monolith**
        All libraries in single app`"]
        
        Microservices["`**Microservices**
        Service per domain`"]
        
        Hybrid["`**Hybrid Approach**
        Core services + libs`"]
    end

    subgraph "Infrastructure Patterns"
        K8s["`**Kubernetes**
        Container orchestration`"]
        
        Docker["`**Docker Compose**
        Local/dev deployment`"]
        
        Cloud["`**Cloud Native**
        Managed services`"]
    end

    subgraph "Data Deployment"
        MongoCluster["`**MongoDB Cluster**
        Replica set`"]
        
        RedisCluster["`**Redis Cluster**
        High availability`"]
        
        KafkaCluster["`**Kafka Cluster**
        Event streaming`"]
    end

    Monolith --> K8s
    Microservices --> K8s
    Hybrid --> Docker
    
    K8s --> MongoCluster
    K8s --> RedisCluster
    K8s --> KafkaCluster
```

## Next Steps

Now that you understand the architecture:

1. **[Security Best Practices](../security/README.md)** - Dive into security implementation
2. **[Testing Guide](../testing/README.md)** - Learn testing strategies  
3. **[Local Development](../setup/local-development.md)** - Set up development environment
4. **[Contributing Guidelines](../contributing/guidelines.md)** - Start contributing

## Architecture Decision Records

For detailed architectural decisions and trade-offs, refer to:
- Multi-database strategy rationale
- Event-driven vs request-response patterns
- Multi-tenancy implementation approaches
- Security model decisions
- API design philosophy

These decisions are documented in the codebase and community discussions.

---

*The OpenFrame OSS Lib architecture evolves continuously. Join the [OpenMSP Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) to participate in architectural discussions.*