# Architecture Overview

OpenFrame OSS Lib implements a **microservice-ready, event-driven, multi-tenant architecture** optimized for scalable MSP (Managed Service Provider) environments. This document provides a comprehensive overview of the system design, architectural patterns, and component relationships.

## System Architecture

The platform is built on a layered architecture that separates concerns while enabling seamless integration between components:

```mermaid
flowchart TD
    subgraph "Client Layer"
        WebUI["Web UI"]
        MobileApp["Mobile Apps"]
        CLI["CLI Tools"]
        Agents["Machine Agents"]
    end

    subgraph "Edge & Security Layer"
        Gateway["Gateway Service Core<br/>(Spring Cloud Gateway)"]
        BFF["Security OAuth BFF<br/>(Token Management)"]
    end

    subgraph "Identity & Authorization"
        AuthServer["Authorization Service Core<br/>(OAuth2 Server + OIDC)"]
        SecurityCore["Security & OAuth Core<br/>(JWT Utils)"]
    end

    subgraph "API Layer"
        APIService["API Service Core<br/>(GraphQL + REST)"]
        ExternalAPI["External API Service Core<br/>(Public REST API)"]
        APIContracts["API Lib Contracts<br/>(Shared DTOs)"]
    end

    subgraph "Agent & Client Layer"
        ClientCore["Client Agent Core<br/>(Agent Lifecycle)"]
    end

    subgraph "Data Layer"
        MongoDB["Data Mongo Core<br/>(Primary Persistence)"]
        Redis["Data Redis Cache<br/>(Caching + Sessions)"]
        Kafka["Data Kafka Core<br/>(Event Streaming)"]
        DataPlatform["Data Platform Core<br/>(Pinot + Cassandra)"]
    end

    subgraph "Stream Processing"
        StreamCore["Stream Processing Core<br/>(Real-time Event Processing)"]
    end

    subgraph "Management & Operations"
        Management["Management Service Core<br/>(Infrastructure Control)"]
    end

    subgraph "External Systems"
        FleetDM["FleetDM"]
        TacticalRMM["TacticalRMM"]
        Cassandra["Apache Cassandra"]
        Pinot["Apache Pinot"]
    end

    %% Client connections
    WebUI --> Gateway
    MobileApp --> Gateway  
    CLI --> Gateway
    Agents --> ClientCore

    %% Edge layer
    Gateway --> APIService
    Gateway --> ExternalAPI
    Gateway --> AuthServer
    BFF --> Gateway

    %% Identity layer
    AuthServer --> SecurityCore
    APIService --> SecurityCore
    ExternalAPI --> SecurityCore

    %% API layer
    APIService --> APIContracts
    ExternalAPI --> APIContracts
    
    %% Data connections
    APIService --> MongoDB
    APIService --> Redis
    APIService --> Kafka
    
    ExternalAPI --> MongoDB
    ExternalAPI --> Redis
    
    AuthServer --> MongoDB
    ClientCore --> MongoDB
    ClientCore --> Kafka
    
    %% Stream processing
    Kafka --> StreamCore
    StreamCore --> DataPlatform
    StreamCore --> Cassandra
    StreamCore --> Pinot
    
    %% Management
    Management --> MongoDB
    Management --> Redis
    Management --> Kafka
    Management --> Pinot
    
    %% External integrations
    DataPlatform --> FleetDM
    DataPlatform --> TacticalRMM
```

## Core Design Principles

### 1. Multi-Tenancy by Design

Every component is built for multi-tenancy from the ground up:

- **Tenant-scoped data access** - All queries include tenant context
- **Isolated security contexts** - Per-tenant JWT signing keys  
- **Resource isolation** - Database collections and cache keys are tenant-prefixed
- **Configuration per tenant** - SSO, integrations, and settings are tenant-specific

### 2. Event-Driven Architecture

Components communicate through events rather than direct calls:

- **Apache Kafka** for inter-service messaging and event streams
- **NATS** for real-time agent communication  
- **Debezium** for database change data capture
- **Reactive programming** patterns throughout the stack

### 3. API-First Development

All functionality is exposed through well-defined APIs:

- **GraphQL** for complex queries with cursor-based pagination
- **REST** for command operations and external integrations
- **OpenAPI** documentation for all endpoints
- **SDK patterns** for tool integrations

### 4. Security as Foundation

Security is embedded at every architectural layer:

- **Asymmetric JWT (RS256)** for stateless token validation
- **OAuth2 Authorization Code + PKCE** for secure authentication flows
- **API key management** with rate limiting and usage tracking
- **Multi-tenant key isolation** with per-tenant RSA key pairs

## Architectural Layers Deep Dive

### Edge & Security Layer

#### Gateway Service Core
**Role**: Reactive API Gateway and traffic routing

```mermaid
flowchart LR
    Client[Client Request] --> Gateway[Gateway Service]
    Gateway --> JWTValidation[JWT Validation]
    Gateway --> RateLimit[Rate Limiting]  
    Gateway --> RouteTarget[Route to Target]
    RouteTarget --> APIService[API Service]
    RouteTarget --> ExternalAPI[External API]
    RouteTarget --> AuthService[Auth Service]
```

**Key Capabilities:**
- Multi-tenant JWT validation with cached decoders
- API key enforcement with Redis-backed rate limiting
- WebSocket proxying for agent and tool connections
- Request/response transformation and header normalization
- Circuit breaker patterns for downstream service protection

#### Security OAuth BFF
**Role**: Backend-for-Frontend OAuth2 orchestration

- **PKCE-enabled OAuth2** flows for web and mobile clients
- **Cookie-based session management** with secure, HTTP-only cookies
- **Token refresh automation** with rotation policies
- **CSRF protection** through state parameter validation

### Identity & Authorization Layer

#### Authorization Service Core  
**Role**: Multi-tenant OAuth2 Authorization Server

```mermaid
sequenceDiagram
    participant Client as Client App
    participant BFF as OAuth BFF
    participant AuthSrv as Auth Server
    participant MongoDB as MongoDB

    Client->>BFF: Initiate OAuth Flow
    BFF->>AuthSrv: Authorization Request + PKCE
    AuthSrv->>MongoDB: Lookup Tenant Config
    AuthSrv->>Client: Authorization UI
    Client->>AuthSrv: User Consent
    AuthSrv->>BFF: Authorization Code
    BFF->>AuthSrv: Code Exchange + PKCE Verifier
    AuthSrv->>BFF: Access + Refresh Tokens
    BFF->>Client: Set Secure Cookies
```

**Key Features:**
- **OIDC-compliant** authorization server
- **Per-tenant RSA key management** for JWT signing
- **SSO provider integration** (Google, Microsoft, custom OIDC)
- **Dynamic client registration** for multi-tenant applications
- **Invitation-based user onboarding** with email verification

#### Security & OAuth Core
**Role**: Shared security utilities and JWT infrastructure

- **JWT encoding/decoding** with RS256 asymmetric cryptography
- **PKCE utility functions** for secure authorization code flows
- **Key management abstractions** for tenant-specific signing keys
- **Security constants** and shared configuration patterns

### API Layer

#### API Service Core
**Role**: Internal GraphQL + REST API for administrative operations

```mermaid
flowchart TD
    GraphQLRequest[GraphQL Query] --> DataFetcher[Data Fetchers]
    RESTRequest[REST Mutation] --> Controller[Controllers]
    
    DataFetcher --> Service[Service Layer]
    Controller --> Service
    
    Service --> MongoDB[(MongoDB)]
    Service --> Redis[(Redis Cache)]
    Service --> Kafka[Kafka Producer]
    
    DataFetcher --> DataLoader[DataLoaders]
    DataLoader --> BatchQuery[Batch Queries]
    BatchQuery --> MongoDB
```

**Core Functionality:**
- **GraphQL API** with Netflix DGS framework
- **Cursor-based pagination** for efficient large dataset queries
- **DataLoader pattern** to prevent N+1 query problems
- **Multi-tenant data filtering** at the repository layer
- **Real-time subscriptions** for live data updates

#### External API Service Core
**Role**: Public REST API secured by API keys

- **OpenAPI-documented** REST endpoints for external integrations
- **API key authentication** with tenant-scoped access control
- **Rate limiting** based on API key tiers and usage quotas
- **Webhook support** for event notifications to external systems

#### API Lib Contracts
**Role**: Shared DTOs, filters, and data contracts

- **Consistent data models** across all API layers
- **Validation annotations** for request/response validation
- **Cursor pagination models** for efficient data access
- **Filter builders** for complex query construction

### Agent & Client Layer

#### Client Agent Core
**Role**: Machine agent lifecycle and tool integration management

```mermaid
flowchart LR
    Agent[Machine Agent] --> Register[Registration Service]
    Register --> Validate[Secret Validation]
    Validate --> Transform[ID Transformation]
    Transform --> OAuth[Token Issuance]
    OAuth --> Track[Installation Tracking]
    Track --> Heartbeat[Heartbeat Processing]
    Heartbeat --> NATS[NATS Events]
    NATS --> StreamProcessing[Stream Processing]
```

**Key Responsibilities:**
- **Agent registration** with tool-specific secret validation
- **OAuth2 client credentials** token issuance for agents
- **Tool ID transformation** between different MSP platforms
- **Installation orchestration** for tool agents on managed machines
- **Heartbeat processing** for agent health monitoring

### Data Layer

#### Data Mongo Core
**Role**: Primary operational data persistence

**Domain Models:**
- **Organizations** (multi-tenant isolation boundary)
- **Users** with role-based access control
- **Devices/Machines** with tool integration status
- **Events** for audit trails and operational history
- **OAuth2 clients and tokens** for authorization state
- **SSO configurations** per tenant

**Repository Patterns:**
- **Custom repository interfaces** extending Spring Data MongoDB
- **Tenant-scoped queries** using `@Query` annotations
- **Cursor-based pagination** implementations
- **Change stream listeners** for real-time data sync

#### Data Redis Cache
**Role**: Distributed caching and session management

- **Multi-tenant key prefixing** (`openframe:{tenantId}:{key}`)
- **JWT decoder caching** to reduce cryptographic overhead
- **API rate limiting** counters and sliding window algorithms
- **Session storage** for OAuth2 authorization flows

#### Data Kafka Core
**Role**: Event streaming infrastructure

```mermaid
flowchart LR
    Producer[Event Producers] --> TopicMgmt[Topic Management]
    TopicMgmt --> KafkaBroker[Kafka Brokers]
    KafkaBroker --> Consumer[Stream Consumers]
    Consumer --> Processing[Event Processing]
    
    TopicMgmt --> TenantIsolation[Tenant Topic Isolation]
    Processing --> DeadLetter[Dead Letter Queues]
    Processing --> RetryLogic[Retry Mechanisms]
```

**Event Categories:**
- **Integrated tool events** from FleetDM, TacticalRMM, etc.
- **Machine lifecycle events** (registration, status changes)
- **User activity events** (login, configuration changes)
- **System events** (errors, performance metrics)

#### Data Platform Core
**Role**: Analytics and time-series data orchestration

- **Apache Pinot** integration for real-time analytics queries
- **Cassandra** configuration for time-series event storage
- **Tool SDK coordination** for external system integrations
- **Data enrichment pipelines** with Redis-backed caching

### Stream Processing Layer

#### Stream Processing Core
**Role**: Real-time event transformation and enrichment

```mermaid
flowchart TD
    ToolEvents[Tool-Specific Events] --> Deserializer[Event Deserializers]
    Deserializer --> Normalize[Event Normalization]
    Normalize --> Enrich[Data Enrichment]
    Enrich --> UnifiedEvent[Unified Event Format]
    UnifiedEvent --> MultiSink[Multi-Sink Output]
    
    MultiSink --> CassandraLogs[Cassandra Logs]
    MultiSink --> PinotMetrics[Pinot Metrics]
    MultiSink --> KafkaUnified[Unified Events Topic]
    
    Enrich --> RedisCache[Redis Enrichment Cache]
    Enrich --> MongoLookup[MongoDB Reference Data]
```

**Processing Capabilities:**
- **Tool-specific deserializers** for different event formats
- **Event type normalization** into unified schema
- **Real-time enrichment** with cached reference data
- **Multi-destination routing** based on event type and tenant
- **Error handling** with dead letter queues and retry policies

### Management & Operations Layer

#### Management Service Core
**Role**: Infrastructure orchestration and control plane

**Operational Responsibilities:**
- **Apache Pinot schema** deployment and table management
- **Debezium connector** initialization for change data capture
- **NATS stream management** for agent communication channels  
- **Distributed job scheduling** using ShedLock for coordination
- **API key usage statistics** synchronization between Redis and MongoDB

## Data Flow Patterns

### Event Processing Flow

```mermaid
sequenceDiagram
    participant Tool as External Tool
    participant Kafka as Kafka Broker
    participant Stream as Stream Processor
    participant Enrich as Enrichment Service
    participant Cassandra as Cassandra
    participant Pinot as Apache Pinot
    participant UnifiedTopic as Unified Events

    Tool->>Kafka: Tool-specific event
    Kafka->>Stream: Consume raw event
    Stream->>Enrich: Normalize + enrich
    Enrich->>Stream: Enriched unified event
    
    par Parallel Processing
        Stream->>Cassandra: Store time-series logs
    and
        Stream->>Pinot: Update real-time metrics
    and
        Stream->>UnifiedTopic: Publish unified event
    end
    
    UnifiedTopic->>APIService: Real-time notifications
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client as Client Application
    participant Gateway as API Gateway
    participant AuthSrv as Authorization Server
    participant APIService as API Service
    participant MongoDB as MongoDB

    Client->>Gateway: API Request + JWT
    Gateway->>AuthSrv: Validate JWT (cached)
    AuthSrv-->>Gateway: JWT Valid + Claims
    Gateway->>APIService: Request + Tenant Context
    APIService->>MongoDB: Tenant-scoped query
    MongoDB-->>APIService: Filtered results
    APIService-->>Gateway: Response
    Gateway-->>Client: Final response
```

### Multi-Tenant Data Access Pattern

```java
// Repository pattern with tenant isolation
@Repository
public class DeviceRepository {
    
    @Query("{ 'tenantId': ?0, 'status': ?1 }")
    Page<Device> findByTenantAndStatus(
        String tenantId, 
        DeviceStatus status, 
        Pageable pageable
    );
    
    // Cursor-based pagination for large datasets
    @Query("{ 'tenantId': ?0, '_id': { '$gt': ?1 } }")
    List<Device> findByTenantAfterCursor(
        String tenantId, 
        String cursor, 
        Pageable pageable
    );
}
```

## Scalability Patterns

### Horizontal Scaling

- **Stateless services** with shared Redis session storage
- **Event-driven communication** eliminates direct service dependencies
- **Database sharding** by tenant ID for large-scale deployments
- **Kafka partition distribution** for parallel event processing

### Performance Optimization

- **Connection pooling** for MongoDB, Redis, and Kafka clients
- **Cursor-based pagination** to avoid offset limitations
- **DataLoader batching** to prevent N+1 database queries
- **Caching layers** at multiple levels (Redis, application-level, HTTP)

### Fault Tolerance

- **Circuit breaker patterns** in service-to-service communication
- **Retry mechanisms** with exponential backoff and jitter
- **Dead letter queues** for failed event processing
- **Health checks** and graceful degradation strategies

## Extension Points

### Adding New Tools

1. **Create SDK module** following `sdk/fleetmdm` pattern
2. **Implement event deserializer** in `stream-processing-core`
3. **Add enrichment logic** for tool-specific data normalization
4. **Register tool type** in `data-platform-core`
5. **Update API contracts** for tool-specific endpoints

### Adding New APIs

1. **Define DTOs** in `api-lib-contracts`
2. **Implement GraphQL datafetchers** or REST controllers
3. **Add service layer** with business logic
4. **Create repository methods** with tenant scoping
5. **Write integration tests** using test generators

### Adding New Event Types

1. **Define event schema** in `data-kafka-core`
2. **Implement deserializer** in `stream-processing-core`
3. **Add enrichment rules** for event normalization
4. **Configure routing** to appropriate storage systems
5. **Update analytics schema** in Apache Pinot

## Security Architecture

### Multi-Tenant Security Model

```mermaid
flowchart TD
    TenantA[Tenant A] --> TenantAKey[RSA Key Pair A]
    TenantB[Tenant B] --> TenantBKey[RSA Key Pair B]
    TenantC[Tenant C] --> TenantCKey[RSA Key Pair C]
    
    TenantAKey --> JWTSignA[JWT Signing A]
    TenantBKey --> JWTSignB[JWT Signing B]  
    TenantCKey --> JWTSignC[JWT Signing C]
    
    JWTSignA --> GatewayValidation[Gateway JWT Validation]
    JWTSignB --> GatewayValidation
    JWTSignC --> GatewayValidation
    
    GatewayValidation --> TenantContext[Tenant Context Extraction]
    TenantContext --> DataIsolation[Data Layer Isolation]
```

### API Security Layers

1. **Transport Layer** - TLS 1.3 for all communications
2. **Authentication Layer** - JWT or API key validation
3. **Authorization Layer** - Role-based access control (RBAC)
4. **Data Layer** - Tenant-scoped database queries
5. **Rate Limiting** - Per-tenant and per-API-key quotas

---

**Next Steps:**
- **[Security Deep Dive](../security/README.md)** - Detailed security implementation
- **[Local Development](../setup/local-development.md)** - Run the full architecture locally
- **[Contributing Guide](../contributing/guidelines.md)** - Extend the architecture

This architecture provides the foundation for building scalable, secure, multi-tenant MSP platforms. Each layer is designed for independent scaling while maintaining strong integration boundaries through well-defined APIs and event contracts.