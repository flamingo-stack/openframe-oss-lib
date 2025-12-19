# OpenFrame OSS Library Architecture Overview

This document provides a comprehensive overview of the OpenFrame OSS Library architecture, including component relationships, data flow, and key design patterns.

## High-Level Architecture

```mermaid
flowchart TB
    subgraph "Client Layer"
        WEB[Web UI]
        API[REST API Clients]
        SDK[External SDKs]
    end
    
    subgraph "API Layer"
        REST[REST API Service]
        GRAPHQL[GraphQL API]
        AUTH[Authorization Service]
    end
    
    subgraph "Service Layer"
        ORG[Organization Service]
        DEV[Device Service]
        EVT[Event Service]
        AGT[Agent Service]
        USR[User Service]
    end
    
    subgraph "Integration Layer"
        FLEET[Fleet MDM SDK]
        TACTICAL[Tactical RMM SDK]
        OAUTH[OAuth Providers]
    end
    
    subgraph "Data Layer"
        MONGO[(MongoDB)]
        STREAM[Event Streams]
        CACHE[Cache Layer]
    end
    
    WEB --> REST
    API --> REST
    SDK --> REST
    
    REST --> AUTH
    REST --> ORG
    REST --> DEV
    REST --> EVT
    
    AUTH --> OAUTH
    AGT --> FLEET
    AGT --> TACTICAL
    
    ORG --> MONGO
    DEV --> MONGO
    EVT --> STREAM
    USR --> MONGO
    
    STREAM --> MONGO
```

## Core Components and Responsibilities

| Component | Module | Primary Responsibilities |
|-----------|--------|------------------------|
| **API Library** | `openframe-api-lib` | Shared DTOs, request/response models, common interfaces |
| **API Service** | `openframe-api-service-core` | REST endpoints, request validation, response formatting |
| **Authorization Service** | `openframe-authorization-service-core` | OAuth integration, JWT tokens, client registration |
| **Client Core** | `openframe-client-core` | Business logic, service orchestration, agent management |
| **Data Layer** | `openframe-data-mongo` | MongoDB repositories, document models, query builders |
| **Stream Service** | `openframe-stream-service-core` | Event processing, Debezium integration, message handling |
| **Fleet MDM SDK** | `sdk/fleetmdm` | Fleet MDM API integration, host management, device queries |
| **Tactical RMM SDK** | `sdk/tacticalrmm` | Tactical RMM integration, agent management, script execution |

## Data Flow Architecture

### Organization Management Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant OrgService
    participant Repository
    participant MongoDB
    
    Client->>API: POST /api/organizations
    API->>API: Validate Request
    API->>OrgService: createOrganization(request)
    OrgService->>OrgService: Map DTO to Document
    OrgService->>Repository: save(document)
    Repository->>MongoDB: Insert Document
    MongoDB-->>Repository: Document with ID
    Repository-->>OrgService: Saved Document
    OrgService->>OrgService: Map to Response DTO
    OrgService-->>API: OrganizationResponse
    API-->>Client: HTTP 201 + Response
    
    Note over API,MongoDB: Audit logging happens asynchronously
    OrgService->>Stream: Publish CreateEvent
    Stream->>MongoDB: Store Audit Log
```

### Device Filtering and Query Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DeviceService
    participant FilterBuilder
    participant Repository
    participant MongoDB
    
    Client->>API: POST /api/devices/search
    API->>DeviceService: searchDevices(filters)
    DeviceService->>FilterBuilder: buildQuery(deviceFilters)
    FilterBuilder->>FilterBuilder: Process tag filters
    FilterBuilder->>FilterBuilder: Process organization filters
    FilterBuilder-->>DeviceService: MongoDB Query
    DeviceService->>Repository: findWithQuery(query, pagination)
    Repository->>MongoDB: Aggregation Pipeline
    MongoDB-->>Repository: Result Documents
    Repository-->>DeviceService: Device Documents
    DeviceService->>DeviceService: Map to Response DTOs
    DeviceService-->>API: CountedGenericQueryResult<Device>
    API-->>Client: Paginated Device Response
```

### Event Processing Flow

```mermaid
sequenceDiagram
    participant System
    participant EventService
    participant StreamProcessor
    participant EventFilters
    participant Repository
    participant MongoDB
    
    System->>EventService: Trigger Event
    EventService->>EventService: Create Event Object
    EventService->>StreamProcessor: publishEvent(event)
    StreamProcessor->>EventFilters: applyFilters(event)
    EventFilters-->>StreamProcessor: Filtered Event
    StreamProcessor->>Repository: saveEvent(event)
    Repository->>MongoDB: Store Event
    
    Note over StreamProcessor,MongoDB: Real-time processing
    StreamProcessor->>StreamProcessor: Process for Analytics
    StreamProcessor->>Repository: updateEventMetrics()
    Repository->>MongoDB: Update Aggregations
```

## Module Dependency Relationships

```mermaid
graph TD
    subgraph "API Layer"
        API_LIB[openframe-api-lib]
        API_SERVICE[openframe-api-service-core]
    end
    
    subgraph "Core Services"
        AUTH_SERVICE[openframe-authorization-service-core]
        CLIENT_CORE[openframe-client-core]
        STREAM_SERVICE[openframe-stream-service-core]
    end
    
    subgraph "Data Layer"
        DATA_MONGO[openframe-data-mongo]
    end
    
    subgraph "External SDKs"
        FLEET_SDK[sdk/fleetmdm]
        TACTICAL_SDK[sdk/tacticalrmm]
    end
    
    API_SERVICE --> API_LIB
    API_SERVICE --> AUTH_SERVICE
    API_SERVICE --> CLIENT_CORE
    
    CLIENT_CORE --> API_LIB
    CLIENT_CORE --> DATA_MONGO
    CLIENT_CORE --> FLEET_SDK
    CLIENT_CORE --> TACTICAL_SDK
    
    STREAM_SERVICE --> API_LIB
    STREAM_SERVICE --> DATA_MONGO
    
    AUTH_SERVICE --> DATA_MONGO
    
    FLEET_SDK --> API_LIB
    TACTICAL_SDK --> API_LIB
    
    style API_LIB fill:#e1f5fe
    style DATA_MONGO fill:#f3e5f5
    style AUTH_SERVICE fill:#fff3e0
```

## Key Design Patterns

### 1. DTO Pattern with Lombok

**Purpose**: Standardized data transfer between layers
**Implementation**: Extensive use of Lombok annotations for boilerplate reduction

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationResponse {
    private String id;
    private String organizationId;
    private String name;
    private String category;
    private Integer numberOfEmployees;
    private BigDecimal monthlyRevenue;
    private LocalDate contractStartDate;
    private LocalDate contractEndDate;
    private Boolean isDefault;
    private Boolean deleted;
    private Instant createdAt;
    private Instant updatedAt;
    private ContactInformationDto contactInformation;
}
```

### 2. Reactive Repository Pattern

**Purpose**: Non-blocking database operations with Spring Data MongoDB
**Implementation**: Reactive streams for high-throughput operations

```java
public interface ReactiveOrganizationRepository 
    extends ReactiveMongoRepository<OrganizationDocument, ObjectId> {
    
    Mono<OrganizationDocument> findByOrganizationId(String organizationId);
    Flux<OrganizationDocument> findByCategoryOrderByCreatedAtDesc(String category);
    Mono<Boolean> existsByOrganizationId(String organizationId);
}
```

### 3. Strategy Pattern for OAuth

**Purpose**: Support multiple OAuth providers with pluggable strategies
**Implementation**: Abstract base strategy with provider-specific implementations

```java
public abstract class BaseOidcClientRegistrationStrategy {
    public abstract ClientRegistration buildClientRegistration(
        TenantConfigurationDocument config);
}

public class MicrosoftClientRegistrationStrategy 
    extends BaseOidcClientRegistrationStrategy {
    
    @Override
    public ClientRegistration buildClientRegistration(
        TenantConfigurationDocument config) {
        return ClientRegistration.withRegistrationId("microsoft")
            .clientId(config.getClientId())
            .clientSecret(config.getClientSecret())
            .authorizationUri("https://login.microsoftonline.com/common/oauth2/v2.0/authorize")
            .tokenUri("https://login.microsoftonline.com/common/oauth2/v2.0/token")
            .build();
    }
}
```

### 4. Builder Pattern with Generics

**Purpose**: Type-safe query building and result pagination
**Implementation**: Generic builders for consistent API responses

```java
@SuperBuilder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GenericQueryResult<T> {
    private List<T> items;
    private CursorPageInfo pageInfo;
}

@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CountedGenericQueryResult<T> extends GenericQueryResult<T> {
    private int filteredCount;
}
```

### 5. Filter Composition Pattern

**Purpose**: Flexible and reusable filtering capabilities
**Implementation**: Composable filter objects with builder patterns

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceFilters {
    private List<String> organizationIds;
    private List<DeviceFilterOption> deviceFilterOptions;
    private List<TagFilterOption> tagFilterOptions;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TagFilterOption {
    private String key;
    private List<String> values;
}
```

## Data Storage Architecture

### MongoDB Document Structure

```mermaid
erDiagram
    OrganizationDocument {
        ObjectId id
        string organizationId
        string name
        string category
        int numberOfEmployees
        decimal monthlyRevenue
        date contractStartDate
        date contractEndDate
        boolean isDefault
        boolean deleted
        instant createdAt
        instant updatedAt
        ContactInformationDto contactInformation
    }
    
    DeviceDocument {
        ObjectId id
        string deviceId
        string hostname
        string organizationId
        map tags
        string status
        instant lastSeen
        instant createdAt
        instant updatedAt
    }
    
    EventDocument {
        ObjectId id
        string eventId
        string eventType
        string userId
        string organizationId
        object eventData
        instant timestamp
    }
    
    UserDocument {
        ObjectId id
        string email
        string organizationId
        array roles
        boolean active
        instant createdAt
        instant lastLogin
    }
    
    OrganizationDocument ||--o{ DeviceDocument : "has many"
    OrganizationDocument ||--o{ UserDocument : "has many"
    OrganizationDocument ||--o{ EventDocument : "generates"
    UserDocument ||--o{ EventDocument : "creates"
```

### Query Optimization Strategies

| Collection | Index Strategy | Query Pattern |
|------------|---------------|---------------|
| **organizations** | `organizationId` (unique), `category`, `createdAt` | Lookup by ID, filter by category |
| **devices** | `deviceId`, `organizationId + status`, `tags.environment` | Multi-tenant filtering, tag-based queries |
| **events** | `organizationId + timestamp`, `userId + eventType`, `eventType + timestamp` | Time-range queries, user activity tracking |
| **users** | `email` (unique), `organizationId + active`, `lastLogin` | Authentication, org user management |

## Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthService
    participant OAuthProvider
    participant MongoDB
    
    Client->>API: Request with OAuth Code
    API->>AuthService: validateOAuthCode(code)
    AuthService->>OAuthProvider: Exchange Code for Token
    OAuthProvider-->>AuthService: Access Token + User Info
    AuthService->>AuthService: Extract User Claims
    AuthService->>MongoDB: Find/Create User
    MongoDB-->>AuthService: User Document
    AuthService->>AuthService: Generate JWT Token
    AuthService-->>API: JWT Token + User Info
    API-->>Client: Authentication Response
    
    Note over Client,MongoDB: Subsequent requests use JWT
    Client->>API: Request with JWT
    API->>AuthService: validateJWT(token)
    AuthService-->>API: User Claims
    API->>API: Check Permissions
```

### Authorization Levels

| Level | Scope | Access Pattern |
|-------|-------|---------------|
| **System Admin** | All organizations | Full CRUD on all resources |
| **Organization Admin** | Single organization | Full CRUD within organization |
| **User** | Single organization | Read access + limited updates |
| **Service Account** | API-specific | Programmatic access with scoped permissions |

## Performance Considerations

### Scaling Strategies

1. **Horizontal Scaling**
   - MongoDB sharding on `organizationId`
   - Load balancing across API service instances
   - CDN for static assets

2. **Caching Strategy**
   - Redis for session data and JWT tokens
   - Application-level caching for organization lookups
   - MongoDB query result caching

3. **Database Optimization**
   - Compound indexes for common query patterns
   - Read replicas for analytics queries
   - TTL indexes for temporary data (sessions, tokens)

### Monitoring and Observability

```mermaid
graph LR
    subgraph "Application"
        APP[OpenFrame Services]
        METRICS[Micrometer Metrics]
        LOGS[Structured Logging]
    end
    
    subgraph "Monitoring Stack"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        ALERTS[Alertmanager]
    end
    
    subgraph "Storage"
        MONGODB[(MongoDB)]
        AUDIT[(Audit Logs)]
    end
    
    APP --> METRICS
    APP --> LOGS
    APP --> MONGODB
    APP --> AUDIT
    
    METRICS --> PROMETHEUS
    LOGS --> PROMETHEUS
    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTS
```

## Development Patterns and Best Practices

### Error Handling Strategy

```java
// Global exception handling
@ControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(OrganizationNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleOrganizationNotFound(
        OrganizationNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.builder()
                .code("ORGANIZATION_NOT_FOUND")
                .message(ex.getMessage())
                .timestamp(Instant.now())
                .build());
    }
}
```

### Testing Architecture

```mermaid
pyramid
    title Testing Strategy
    
    component "Unit Tests" "65%"
    component "Integration Tests" "25%"
    component "E2E Tests" "10%"
```

| Test Type | Purpose | Tools | Coverage |
|-----------|---------|--------|----------|
| **Unit Tests** | Individual component logic | JUnit 5, Mockito | >80% code coverage |
| **Integration Tests** | Component interaction | TestContainers, MockMvc | API endpoints, database operations |
| **E2E Tests** | Full system workflows | RestAssured, Test fixtures | Critical user journeys |

## Future Architecture Considerations

### Planned Enhancements

1. **Microservices Migration**
   - Break monolith into domain-specific services
   - Event-driven communication between services
   - Service mesh for inter-service communication

2. **Event Sourcing**
   - Implement event sourcing for audit trail
   - CQRS pattern for read/write separation
   - Event replay capabilities for data reconstruction

3. **Multi-tenancy Improvements**
   - Database-per-tenant option
   - Enhanced isolation and security
   - Tenant-specific customizations

This architecture overview provides the foundation for understanding how OpenFrame OSS Library components work together. For implementation details, refer to the individual module documentation in `docs/dev/module_*.md`.