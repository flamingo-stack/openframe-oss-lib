# Architecture Overview

OpenFrame OSS Library is built with a modern, microservices-oriented architecture designed for scalability, maintainability, and extensibility. This guide provides a comprehensive overview of the system architecture, design patterns, and component relationships.

## High-Level System Architecture

OpenFrame follows a layered, domain-driven design with clear separation of concerns across multiple services and modules.

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Application]
        CLI[CLI Tools]
        SDK[SDKs]
        API_CLIENT[API Clients]
    end
    
    subgraph "API Gateway Layer"
        GATEWAY[OpenFrame Gateway]
        OAUTH[OAuth2 Service]
        RATE[Rate Limiting]
        CORS[CORS Handler]
    end
    
    subgraph "Service Layer"
        API[API Service]
        CLIENT[Client Service]
        MGMT[Management Service]
        STREAM[Stream Service]
        AUTH[Authorization Service]
        EXT_API[External API Service]
    end
    
    subgraph "Integration Layer"
        FLEET[FleetDM SDK]
        TACTICAL[Tactical RMM SDK]
        MESH[MeshCentral SDK]
        AGENTS[Agent Connectors]
    end
    
    subgraph "Data Layer"
        MONGO[(MongoDB)]
        REDIS[(Redis)]
        KAFKA[Apache Kafka]
        PINOT[Apache Pinot]
        CASSANDRA[(Cassandra)]
    end
    
    subgraph "Infrastructure Layer"
        K8S[Kubernetes]
        DOCKER[Docker]
        NGINX[Load Balancer]
        MONITOR[Monitoring]
    end
    
    WEB --> GATEWAY
    CLI --> GATEWAY
    SDK --> GATEWAY
    API_CLIENT --> GATEWAY
    
    GATEWAY --> API
    GATEWAY --> CLIENT
    GATEWAY --> MGMT
    
    API --> MONGO
    API --> REDIS
    API --> KAFKA
    
    CLIENT --> FLEET
    CLIENT --> TACTICAL
    CLIENT --> MESH
    CLIENT --> AGENTS
    
    STREAM --> KAFKA
    STREAM --> PINOT
    STREAM --> CASSANDRA
    
    AUTH --> MONGO
    AUTH --> REDIS
    
    MGMT --> MONGO
    MGMT --> KAFKA
    
    style GATEWAY fill:#e1f5fe
    style MONGO fill:#4caf50,color:#fff
    style KAFKA fill:#ff9800,color:#fff
    style REDIS fill:#f44336,color:#fff
```

## Core Design Principles

### 1. Domain-Driven Design (DDD)

OpenFrame is organized around business domains:

- **Device Management** - Physical and virtual asset tracking
- **Organization Management** - Multi-tenant MSP customer management  
- **Event Processing** - Real-time activity monitoring and alerting
- **Tool Integration** - External MSP tool connectivity
- **User Management** - Authentication, authorization, and access control

### 2. Microservices Architecture

Each service has a specific responsibility and can be deployed independently:

```mermaid
graph LR
    subgraph "Core Services"
        A[API Service<br/>REST/GraphQL APIs]
        B[Client Service<br/>Agent Management]
        C[Gateway Service<br/>Routing & Auth]
    end
    
    subgraph "Supporting Services"
        D[Management Service<br/>Admin Functions]
        E[Stream Service<br/>Event Processing]
        F[Auth Service<br/>OAuth2/OIDC]
    end
    
    A -.->|Async Events| E
    B -.->|Agent Data| E
    C -->|Routes| A
    C -->|Routes| B
    D -.->|Config| A
    D -.->|Config| B
    F -->|Tokens| C
```

### 3. Event-Driven Architecture

Services communicate through events, ensuring loose coupling:

```mermaid
sequenceDiagram
    participant Device
    participant Client as Client Service
    participant Kafka
    participant Stream as Stream Service
    participant API as API Service
    participant DB as Database
    
    Device->>Client: Agent Heartbeat
    Client->>Kafka: Device Status Event
    Kafka->>Stream: Process Event
    Stream->>DB: Store Processed Data
    Stream->>Kafka: Enriched Event
    Kafka->>API: Update Device State
    API->>DB: Update Device Record
```

## Module Architecture

### Core Modules

#### openframe-core
Foundation module with shared utilities and common functionality.

```mermaid
graph TD
    CORE[openframe-core] --> UTIL[Utilities]
    CORE --> VALID[Validation]
    CORE --> EXCEPT[Exception Handling]
    CORE --> CONFIG[Configuration]
    
    UTIL --> SLUG[Slug Generation]
    UTIL --> ENCRYPT[Encryption Service]
    UTIL --> PROXY[Proxy URL Resolver]
    
    VALID --> EMAIL[Email Validator]
    VALID --> DOMAIN[Domain Validator]
    
    CONFIG --> SECURITY[Security Config]
    CONFIG --> DATA[Data Config]
```

**Key Components:**
- `SlugUtil` - Consistent slug generation
- `EncryptionService` - Data encryption/decryption
- `ValidEmailValidator` - Email format validation
- `TenantDomainValidator` - Multi-tenant domain validation

#### openframe-data-mongo
MongoDB data layer with document models and repositories.

```mermaid
graph TD
    DATA[openframe-data-mongo] --> DOCS[Document Models]
    DATA --> REPOS[Repositories]
    DATA --> CONFIG[Configuration]
    
    DOCS --> ORG[Organization]
    DOCS --> DEV[Device/Machine]
    DOCS --> EVENT[Event]
    DOCS --> TOOL[Tool]
    DOCS --> USER[User]
    
    REPOS --> CUSTOM[Custom Repositories]
    REPOS --> SPRING[Spring Data Repos]
    
    CONFIG --> MONGO[MongoDB Config]
    CONFIG --> INDEX[Index Configuration]
```

**Key Components:**
- **Documents**: `Organization`, `Device`, `Event`, `Tool`, `User`
- **Repositories**: Custom queries and aggregations
- **Configuration**: Connection management and indexing

#### openframe-security-core  
Security infrastructure with JWT and OAuth2 support.

```mermaid
graph TD
    SEC[openframe-security-core] --> JWT[JWT Management]
    SEC --> OAUTH[OAuth2 Support]
    SEC --> AUTH[Authentication]
    SEC --> AUTHZ[Authorization]
    
    JWT --> TOKEN[Token Service]
    JWT --> KEYS[Key Management]
    JWT --> VALID[Token Validation]
    
    OAUTH --> CONSTANTS[Security Constants]
    OAUTH --> PKCE[PKCE Utils]
    
    AUTH --> PRINCIPAL[Auth Principal]
    AUTH --> RESOLVER[Principal Resolver]
    
    AUTHZ --> CONFIG[Security Config]
    AUTHZ --> FILTERS[Security Filters]
```

**Key Components:**
- `JwtService` - Token creation and validation
- `AuthPrincipal` - User context and claims
- `PKCEUtils` - OAuth2 PKCE flow support
- `JwtSecurityConfig` - Spring Security integration

### Service Modules

#### openframe-api-service-core
Main API service with REST and GraphQL endpoints.

```mermaid
graph TD
    API[openframe-api-service-core] --> CTRL[Controllers]
    API --> GQL[GraphQL]
    API --> SVC[Services]
    API --> CONFIG[Configuration]
    
    CTRL --> REST[REST Controllers]
    CTRL --> DEVICE[Device Controller]
    CTRL --> ORG[Organization Controller]
    
    GQL --> FETCHER[Data Fetchers]
    GQL --> LOADER[Data Loaders]
    
    SVC --> BIZ[Business Logic]
    SVC --> VALIDATION[Validation]
    
    CONFIG --> SECURITY[Security Config]
    CONFIG --> DATA[Data Source Config]
    CONFIG --> API_CONFIG[API Configuration]
```

**Key Features:**
- RESTful APIs for all major entities
- GraphQL endpoint with efficient data loading
- Multi-tenant request handling
- Comprehensive input validation

#### openframe-client-core
Agent management and device connectivity.

```mermaid
graph TD
    CLIENT[openframe-client-core] --> AGENT[Agent Management]
    CLIENT --> CONN[Connectivity]
    CLIENT --> REG[Registration]
    CLIENT --> METRICS[Metrics Collection]
    
    AGENT --> INSTALL[Agent Installation]
    AGENT --> UPDATE[Agent Updates]
    AGENT --> STATUS[Status Monitoring]
    
    CONN --> HEARTBEAT[Heartbeat Handling]
    CONN --> MESSAGING[Message Processing]
    
    REG --> SECRET[Secret Validation]
    REG --> MACHINE[Machine ID Generation]
    
    METRICS --> COLLECT[Data Collection]
    METRICS --> PROCESS[Processing]
```

**Key Features:**
- Agent registration and authentication
- Heartbeat monitoring and status tracking
- Tool-specific agent management (FleetDM, Tactical RMM)
- Metrics collection and forwarding

#### openframe-gateway-service-core
API gateway with routing, authentication, and rate limiting.

```mermaid
graph TD
    GATEWAY[openframe-gateway-service-core] --> ROUTE[Routing]
    GATEWAY --> AUTH[Authentication]
    GATEWAY --> RATE[Rate Limiting]
    GATEWAY --> CORS[CORS Handling]
    
    ROUTE --> FILTER[Route Filters]
    ROUTE --> BALANCE[Load Balancing]
    
    AUTH --> JWT[JWT Validation]
    AUTH --> API_KEY[API Key Auth]
    AUTH --> OAUTH[OAuth2 Flow]
    
    RATE --> REDIS_LIMIT[Redis Rate Store]
    RATE --> RULES[Rate Limit Rules]
    
    CORS --> CONFIG[CORS Configuration]
    CORS --> ORIGIN[Origin Validation]
```

**Key Features:**
- Centralized request routing
- Multiple authentication methods
- Redis-backed rate limiting
- CORS policy enforcement
- WebSocket proxying for real-time features

### Integration Modules

#### SDK Modules (FleetDM, Tactical RMM)
Tool-specific integration SDKs.

```mermaid
graph TD
    SDK[Tool SDKs] --> FLEET[FleetDM SDK]
    SDK --> TACTICAL[Tactical RMM SDK]
    
    FLEET --> API[API Client]
    FLEET --> MODEL[Data Models]
    FLEET --> EXCEPT[Exception Handling]
    
    TACTICAL --> REST[REST Client]
    TACTICAL --> AUTH[Authentication]
    TACTICAL --> SCRIPT[Script Management]
    
    API --> HOST[Host Management]
    API --> QUERY[Query Execution]
    
    REST --> AGENT[Agent Operations]
    REST --> CLIENT[Client Operations]
    
    MODEL --> HOST_MODEL[Host Model]
    MODEL --> QUERY_MODEL[Query Model]
    
    AUTH --> TOKEN[Token Management]
    AUTH --> CREDS[Credential Handling]
```

**FleetDM SDK Features:**
- Host search and management
- Query execution and results
- Comprehensive error handling

**Tactical RMM SDK Features:**
- Agent registration and management  
- Script execution and monitoring
- Client organization mapping

## Data Flow Architecture

### Request Processing Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant API as API Service
    participant Service as Business Service
    participant Repository
    participant Database
    participant Cache as Redis Cache
    participant Events as Event Stream
    
    Client->>Gateway: HTTP Request
    Gateway->>Gateway: Authentication & Rate Limiting
    Gateway->>API: Forwarded Request
    API->>API: Input Validation
    API->>Service: Business Logic Call
    Service->>Cache: Check Cache
    alt Cache Hit
        Cache-->>Service: Cached Data
    else Cache Miss
        Service->>Repository: Database Query
        Repository->>Database: Execute Query
        Database-->>Repository: Results
        Repository-->>Service: Mapped Results
        Service->>Cache: Update Cache
    end
    Service->>Events: Publish Event (Async)
    Service-->>API: Business Result
    API-->>Gateway: HTTP Response
    Gateway-->>Client: Final Response
    
    Events->>Events: Event Processing (Background)
```

### Event Processing Flow

```mermaid
graph TD
    SOURCE[Event Sources] --> KAFKA[Apache Kafka]
    KAFKA --> STREAM[Stream Service]
    STREAM --> ENRICH[Data Enrichment]
    ENRICH --> TRANSFORM[Transformation]
    TRANSFORM --> ROUTE[Event Routing]
    
    ROUTE --> DB[Database Storage]
    ROUTE --> CACHE[Cache Updates]  
    ROUTE --> NOTIFY[Notifications]
    ROUTE --> EXTERNAL[External Systems]
    
    subgraph "Event Sources"
        AGENT[Agent Events]
        API_EVENT[API Events]
        TOOL_EVENT[Tool Events]
        SYSTEM[System Events]
    end
    
    subgraph "Processing Pipeline"
        FILTER[Filtering]
        AGGREGATE[Aggregation]
        CORRELATION[Event Correlation]
    end
    
    STREAM --> FILTER
    FILTER --> AGGREGATE
    AGGREGATE --> CORRELATION
    CORRELATION --> ROUTE
```

## Security Architecture

### Multi-Tenant Security

```mermaid
graph TD
    REQUEST[Incoming Request] --> GATEWAY[API Gateway]
    GATEWAY --> JWT_VALIDATE[JWT Validation]
    JWT_VALIDATE --> TENANT_EXTRACT[Tenant Context Extraction]
    TENANT_EXTRACT --> RBAC[Role-Based Access Control]
    RBAC --> DATA_ISOLATION[Data Isolation Filter]
    DATA_ISOLATION --> SERVICE[Business Service]
    
    subgraph "Security Layers"
        TRANSPORT[TLS/HTTPS]
        AUTH[Authentication]
        AUTHZ[Authorization]  
        ISOLATION[Data Isolation]
    end
    
    TRANSPORT --> AUTH
    AUTH --> AUTHZ
    AUTHZ --> ISOLATION
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Auth as Auth Service
    participant API as API Service
    participant DB as Database
    
    Client->>Gateway: Login Request
    Gateway->>Auth: Validate Credentials
    Auth->>DB: User Lookup
    DB-->>Auth: User Data
    Auth->>Auth: Generate JWT
    Auth-->>Gateway: JWT Token
    Gateway-->>Client: Token Response
    
    Note over Client,Gateway: Subsequent Requests
    Client->>Gateway: API Request + JWT
    Gateway->>Gateway: Validate JWT
    Gateway->>API: Authorized Request
    API->>API: Extract Tenant Context
    API->>DB: Tenant-Scoped Query
    DB-->>API: Filtered Results
    API-->>Gateway: Response
    Gateway-->>Client: Final Response
```

## Performance & Scalability

### Horizontal Scaling Strategy

```mermaid
graph TD
    LOAD[Load Balancer] --> GATEWAY1[Gateway 1]
    LOAD --> GATEWAY2[Gateway 2]
    LOAD --> GATEWAY3[Gateway N]
    
    GATEWAY1 --> API1[API Service 1]
    GATEWAY2 --> API2[API Service 2]
    GATEWAY3 --> API3[API Service N]
    
    API1 --> REDIS[Redis Cluster]
    API2 --> REDIS
    API3 --> REDIS
    
    API1 --> MONGO[MongoDB Cluster]
    API2 --> MONGO
    API3 --> MONGO
    
    subgraph "Event Processing"
        KAFKA[Kafka Cluster]
        STREAM1[Stream Service 1]
        STREAM2[Stream Service 2]
        STREAM3[Stream Service N]
    end
    
    API1 --> KAFKA
    API2 --> KAFKA
    API3 --> KAFKA
    
    KAFKA --> STREAM1
    KAFKA --> STREAM2
    KAFKA --> STREAM3
```

### Caching Strategy

```mermaid
graph TD
    CLIENT[Client Request] --> L1[L1: Application Cache]
    L1 --> L2[L2: Redis Cache]
    L2 --> L3[L3: Database]
    
    L1 -.->|Cache Miss| L2
    L2 -.->|Cache Miss| L3
    
    L3 -.->|Write Through| L2
    L2 -.->|Write Through| L1
    
    subgraph "Cache Policies"
        TTL[TTL-based Expiration]
        LRU[LRU Eviction]
        INVALIDATION[Event-based Invalidation]
    end
    
    L1 --> TTL
    L2 --> LRU
    L2 --> INVALIDATION
```

## Development Patterns

### Repository Pattern

```java
// Abstract repository interface
public interface BaseRepository<T, ID> {
    Optional<T> findById(ID id);
    List<T> findAll();
    T save(T entity);
    void deleteById(ID id);
}

// Custom repository with business-specific queries
public interface OrganizationRepository extends BaseRepository<Organization, String> {
    Optional<Organization> findByDomain(String domain);
    List<Organization> findByStatusAndPlan(OrganizationStatus status, TenantPlan plan);
}
```

### Service Layer Pattern

```java
@Service
@Transactional
public class OrganizationService {
    
    @Autowired
    private OrganizationRepository repository;
    
    @Autowired
    private EventPublisher eventPublisher;
    
    public Organization createOrganization(CreateOrganizationRequest request) {
        // Business validation
        validateOrganizationRequest(request);
        
        // Create entity
        Organization org = mapToEntity(request);
        
        // Persist
        Organization saved = repository.save(org);
        
        // Publish event
        eventPublisher.publish(new OrganizationCreatedEvent(saved));
        
        return saved;
    }
}
```

### Event Publishing Pattern

```java
@Component
public class EventPublisher {
    
    @Autowired
    private KafkaTemplate<String, Object> kafkaTemplate;
    
    public void publish(DomainEvent event) {
        kafkaTemplate.send(
            event.getTopicName(),
            event.getPartitionKey(),
            event
        );
    }
}
```

## Error Handling & Resilience

### Circuit Breaker Pattern

```java
@Component
public class ExternalServiceClient {
    
    @CircuitBreaker(name = "fleetdm", fallbackMethod = "fallbackMethod")
    @Retry(name = "fleetdm")
    @TimeLimiter(name = "fleetdm")
    public CompletableFuture<List<Host>> getHosts() {
        return CompletableFuture.supplyAsync(() -> 
            fleetdmClient.searchHosts(new HostSearchRequest()));
    }
    
    public CompletableFuture<List<Host>> fallbackMethod(Exception ex) {
        return CompletableFuture.completedFuture(getCachedHosts());
    }
}
```

### Global Exception Handling

```java
@ControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidation(ValidationException ex) {
        return ResponseEntity.badRequest()
            .body(new ErrorResponse("VALIDATION_ERROR", ex.getMessage()));
    }
    
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(EntityNotFoundException ex) {
        return ResponseEntity.notFound().build();
    }
}
```

## Deployment Architecture

### Container Orchestration

```mermaid
graph TD
    subgraph "Kubernetes Cluster"
        subgraph "API Tier"
            API_POD1[API Pod 1]
            API_POD2[API Pod 2] 
            API_SVC[API Service]
        end
        
        subgraph "Gateway Tier"  
            GW_POD1[Gateway Pod 1]
            GW_POD2[Gateway Pod 2]
            GW_SVC[Gateway Service]
        end
        
        subgraph "Data Tier"
            MONGO_SET[MongoDB ReplicaSet]
            REDIS_CLUSTER[Redis Cluster]
            KAFKA_CLUSTER[Kafka Cluster]
        end
        
        subgraph "Ingress"
            INGRESS[Nginx Ingress]
            CERT[Cert Manager]
        end
    end
    
    INGRESS --> GW_SVC
    GW_SVC --> API_SVC
    API_SVC --> MONGO_SET
    API_SVC --> REDIS_CLUSTER
    API_SVC --> KAFKA_CLUSTER
    
    CERT --> INGRESS
```

## Monitoring & Observability

### Observability Stack

```mermaid
graph TD
    APP[Applications] --> METRICS[Metrics Collection]
    APP --> LOGS[Log Aggregation]
    APP --> TRACES[Distributed Tracing]
    
    METRICS --> PROMETHEUS[Prometheus]
    LOGS --> ELK[ELK Stack]
    TRACES --> JAEGER[Jaeger]
    
    PROMETHEUS --> GRAFANA[Grafana Dashboards]
    ELK --> KIBANA[Kibana]
    JAEGER --> JAEGER_UI[Jaeger UI]
    
    subgraph "Alerting"
        ALERT_MANAGER[AlertManager]
        PAGERDUTY[PagerDuty]
        SLACK[Slack]
    end
    
    PROMETHEUS --> ALERT_MANAGER
    ALERT_MANAGER --> PAGERDUTY
    ALERT_MANAGER --> SLACK
```

## Next Steps

This architecture overview provides the foundation for understanding OpenFrame's design. For hands-on implementation:

1. **[Testing Overview](../testing/overview.md)** - Learn testing strategies for this architecture
2. **[Contributing Guidelines](../contributing/guidelines.md)** - Understand how to contribute effectively
3. **[Reference Documentation](../../reference/)** - Dive deep into specific modules

## Key Takeaways

✅ **Microservices**: Each service has a single responsibility  
✅ **Event-Driven**: Services communicate through events for loose coupling  
✅ **Multi-Tenant**: Built-in isolation and security from the ground up  
✅ **Scalable**: Horizontal scaling across all tiers  
✅ **Observable**: Comprehensive monitoring and tracing  
✅ **Resilient**: Circuit breakers, retries, and graceful degradation  

---

Understanding this architecture will help you navigate the codebase, make effective contributions, and build robust MSP solutions with OpenFrame! 🏗️