# Architecture Overview

Understanding OpenFrame OSS Library's architecture is essential for effective development. This comprehensive guide covers the high-level system design, data flow patterns, module relationships, and key architectural decisions that shape the platform.

## 🏗️ High-Level System Architecture

OpenFrame OSS Library follows a modular, microservices-ready architecture with clear separation of concerns and well-defined boundaries between layers.

### System Components

```mermaid
graph TB
    subgraph "Client Layer"
        WebApp["Web Application"]
        MobileApp["Mobile App"]  
        SDK["Integration SDKs"]
        CLI["CLI Tools"]
    end
    
    subgraph "API Gateway Layer"
        Gateway["openframe-gateway-service-core<br/>• Request routing<br/>• Rate limiting<br/>• Authentication"]
    end
    
    subgraph "Service Layer"
        API["openframe-api-service-core<br/>• Business logic<br/>• Data validation<br/>• Service orchestration"]
        Auth["openframe-authorization-service-core<br/>• OAuth2/OIDC<br/>• SSO integration<br/>• User management"]
        Client["openframe-client-core<br/>• Agent communication<br/>• Device registration<br/>• Tool management"]
        Stream["openframe-stream-service-core<br/>• Event processing<br/>• Real-time data<br/>• Integration events"]
    end
    
    subgraph "Core Libraries"
        ApiLib["openframe-api-lib<br/>• DTOs<br/>• Service interfaces<br/>• Validation rules"]
        DataMongo["openframe-data-mongo<br/>• Entity models<br/>• Repository interfaces<br/>• Database operations"]
        Core["openframe-core<br/>• Utilities<br/>• Common patterns<br/>• Shared logic"]
        Security["openframe-security-core<br/>• JWT handling<br/>• Auth patterns<br/>• Security utilities"]
    end
    
    subgraph "Data Layer"
        MongoDB["MongoDB<br/>• Primary data store<br/>• Multi-tenant<br/>• ACID transactions"]
        Redis["Redis<br/>• Caching<br/>• Session storage<br/>• Rate limiting"]
        Kafka["Apache Kafka<br/>• Event streaming<br/>• Message processing<br/>• Integration events"]
    end
    
    subgraph "External Integrations"
        TacticalRMM["TacticalRMM"]
        FleetMDM["Fleet MDM"]
        MeshCentral["MeshCentral"]
        Monitoring["Monitoring Tools"]
    end
    
    WebApp --> Gateway
    MobileApp --> Gateway
    SDK --> Gateway
    CLI --> Gateway
    
    Gateway --> API
    Gateway --> Auth
    Gateway --> Client
    
    API --> ApiLib
    Auth --> ApiLib
    Client --> ApiLib
    Stream --> ApiLib
    
    ApiLib --> DataMongo
    DataMongo --> Core
    DataMongo --> Security
    
    API --> MongoDB
    Auth --> MongoDB
    Client --> MongoDB
    Stream --> Kafka
    
    API --> Redis
    Gateway --> Redis
    
    Client --> TacticalRMM
    Client --> FleetMDM
    Client --> MeshCentral
    Stream --> Monitoring
    
    style Gateway fill:#e1f5fe
    style API fill:#f3e5f5
    style ApiLib fill:#e8f5e8
    style MongoDB fill:#fff3e0
```

## 🔄 Data Flow Architecture

Understanding how data flows through the system is crucial for effective development and debugging.

### Request/Response Flow

```mermaid
sequenceDiagram
    participant Client as Client Application
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant API as API Service
    participant DataLib as Data Library
    participant MongoDB as MongoDB
    participant Cache as Redis Cache
    
    Client->>Gateway: API Request
    Gateway->>Auth: Validate Token
    Auth->>Gateway: Token Valid
    Gateway->>API: Forward Request
    
    API->>DataLib: Query/Command
    DataLib->>Cache: Check Cache
    Cache-->>DataLib: Cache Miss/Hit
    
    alt Cache Miss
        DataLib->>MongoDB: Database Query
        MongoDB-->>DataLib: Query Result
        DataLib->>Cache: Store in Cache
    end
    
    DataLib-->>API: Return Data
    API->>API: Business Logic
    API-->>Gateway: Response DTO
    Gateway-->>Client: JSON Response
```

### Event Processing Flow

```mermaid
sequenceDiagram
    participant Tool as External Tool
    participant Client as Client Service
    participant Stream as Stream Service
    participant Kafka as Apache Kafka
    participant API as API Service
    participant MongoDB as MongoDB
    participant WebApp as Web Application
    
    Tool->>Client: Tool Event (webhook/polling)
    Client->>Stream: Raw Event Data
    Stream->>Stream: Event Processing & Enrichment
    Stream->>Kafka: Processed Event
    
    Kafka->>API: Event Notification
    API->>MongoDB: Store Event
    API->>WebApp: Real-time Update (WebSocket)
    
    Note over Stream, API: Events include device changes,<br/>security alerts, compliance updates
```

## 📦 Module Architecture

OpenFrame is organized into focused modules with clear responsibilities and minimal coupling.

### Core Modules Overview

| Module | Purpose | Dependencies | Artifacts |
|--------|---------|--------------|-----------|
| **openframe-core** | Shared utilities and patterns | None | Validation, utilities, constants |
| **openframe-api-lib** | DTOs and service contracts | openframe-core | DTOs, interfaces, validation |
| **openframe-data-mongo** | Data layer implementation | openframe-api-lib | Entities, repositories, queries |
| **openframe-security-core** | Security patterns | openframe-core | JWT, OAuth, encryption |

### Service Modules Overview

| Module | Purpose | Dependencies | Port |
|--------|---------|--------------|------|
| **openframe-api-service-core** | Main business logic API | All core modules | 8080 |
| **openframe-gateway-service-core** | API gateway and routing | Security modules | 8081 |
| **openframe-authorization-service-core** | Authentication/authorization | Security, data modules | 8082 |
| **openframe-client-core** | Agent and tool communication | API lib, data modules | 8083 |

### Module Dependency Graph

```mermaid
graph TD
    Core["openframe-core<br/>Utilities & Patterns"]
    
    ApiLib["openframe-api-lib<br/>DTOs & Interfaces"]
    Security["openframe-security-core<br/>Security Patterns"]
    DataMongo["openframe-data-mongo<br/>Data Models"]
    
    ApiService["openframe-api-service-core<br/>Business Logic"]
    Gateway["openframe-gateway-service-core<br/>API Gateway"]
    AuthService["openframe-authorization-service-core<br/>Auth Service"]
    ClientService["openframe-client-core<br/>Client Communication"]
    
    Core --> ApiLib
    Core --> Security
    Core --> DataMongo
    
    ApiLib --> DataMongo
    ApiLib --> ApiService
    ApiLib --> Gateway
    ApiLib --> AuthService
    ApiLib --> ClientService
    
    Security --> Gateway
    Security --> AuthService
    
    DataMongo --> ApiService
    DataMongo --> AuthService
    DataMongo --> ClientService
    
    style Core fill:#fff3e0
    style ApiLib fill:#e8f5e8
    style ApiService fill:#e1f5fe
    style Gateway fill:#f3e5f5
```

## 🏛️ Architectural Patterns

OpenFrame employs several well-established patterns to ensure maintainability, testability, and scalability.

### Domain-Driven Design

The system is organized around clear business domains:

```mermaid
graph LR
    subgraph "Device Domain"
        DeviceDTO["Device DTOs"]
        DeviceService["Device Service"]
        DeviceRepository["Device Repository"]
        DeviceEntity["Device Entity"]
    end
    
    subgraph "Organization Domain"
        OrgDTO["Organization DTOs"]
        OrgService["Organization Service"] 
        OrgRepository["Organization Repository"]
        OrgEntity["Organization Entity"]
    end
    
    subgraph "Event Domain"
        EventDTO["Event DTOs"]
        EventService["Event Service"]
        EventRepository["Event Repository"]
        EventEntity["Event Entity"]
    end
    
    subgraph "Tool Domain"
        ToolDTO["Tool DTOs"]
        ToolService["Tool Service"]
        ToolRepository["Tool Repository"] 
        ToolEntity["Tool Entity"]
    end
    
    DeviceDTO --> DeviceService
    DeviceService --> DeviceRepository
    DeviceRepository --> DeviceEntity
    
    OrgDTO --> OrgService
    OrgService --> OrgRepository
    OrgRepository --> OrgEntity
    
    EventDTO --> EventService
    EventService --> EventRepository
    EventRepository --> EventEntity
    
    ToolDTO --> ToolService
    ToolService --> ToolRepository
    ToolRepository --> ToolEntity
```

### Layered Architecture Pattern

Each domain follows a consistent layered approach:

```mermaid
graph TD
    Controller["Controllers<br/>HTTP endpoints, validation"]
    ServiceInterface["Service Interfaces<br/>Business logic contracts"]
    ServiceImpl["Service Implementation<br/>Business logic execution"]
    Repository["Repository Layer<br/>Data access abstraction"]
    Entity["Entity Layer<br/>Data models and persistence"]
    
    Controller --> ServiceInterface
    ServiceInterface --> ServiceImpl
    ServiceImpl --> Repository
    Repository --> Entity
    
    Controller -.-> DTO["Request/Response DTOs"]
    ServiceInterface -.-> DTO
    
    style Controller fill:#e1f5fe
    style ServiceInterface fill:#f3e5f5
    style ServiceImpl fill:#e8f5e8
    style Repository fill:#fff3e0
    style Entity fill:#fce4ec
```

### Repository Pattern Implementation

```java
// Example: Device repository pattern
public interface DeviceRepository extends MongoRepository<Device, String> {
    // Standard CRUD operations inherited
    
    // Custom query methods
    Page<Device> findByOrganizationId(String organizationId, Pageable pageable);
    List<Device> findByStatusAndDeviceType(DeviceStatus status, DeviceType type);
    
    // Complex queries with @Query annotation
    @Query("{'tags': {'$in': ?0}, 'status': ?1}")
    Page<Device> findByTagsInAndStatus(List<String> tags, DeviceStatus status, Pageable pageable);
}

// Custom repository for complex operations
public interface CustomDeviceRepository {
    CountedGenericQueryResult<Device> findDevicesWithFilters(DeviceQueryFilter filter);
    List<Device> findDevicesRequiringCompliance();
    Map<String, Long> getDeviceCountsByOrganization();
}

@Repository
public class CustomDeviceRepositoryImpl implements CustomDeviceRepository {
    
    private final MongoTemplate mongoTemplate;
    
    @Override
    public CountedGenericQueryResult<Device> findDevicesWithFilters(DeviceQueryFilter filter) {
        // Implementation using MongoTemplate for complex queries
        Query query = buildQueryFromFilter(filter);
        
        // Get total count for pagination
        long totalCount = mongoTemplate.count(query, Device.class);
        
        // Apply pagination
        query.with(buildPageable(filter.getPagination()));
        
        // Execute query
        List<Device> devices = mongoTemplate.find(query, Device.class);
        
        return CountedGenericQueryResult.<Device>builder()
            .items(devices)
            .totalCount(totalCount)
            .pageInfo(buildPageInfo(filter.getPagination(), totalCount))
            .build();
    }
}
```

## 🗄️ Data Architecture

OpenFrame uses a sophisticated data architecture designed for multi-tenancy, scalability, and consistency.

### MongoDB Schema Design

```mermaid
erDiagram
    Organization ||--o{ Device : owns
    Organization ||--o{ User : employs
    Organization ||--o{ Tool : uses
    Device ||--o{ Event : generates
    Device ||--o{ Alert : triggers
    User ||--o{ Event : performs
    Tool ||--o{ ToolConnection : connects
    ToolConnection ||--o{ Event : creates
    
    Organization {
        string id PK
        string name
        string slug UK
        string website
        enum status
        datetime created_at
        datetime updated_at
        address address
        contact primary_contact
    }
    
    Device {
        string id PK
        string organization_id FK
        string name
        enum device_type
        enum status
        array tags
        object metadata
        datetime last_seen
        datetime created_at
        datetime updated_at
    }
    
    User {
        string id PK
        string organization_id FK
        string email UK
        string first_name
        string last_name
        enum status
        array roles
        datetime created_at
        datetime updated_at
    }
    
    Event {
        string id PK
        string organization_id FK
        string device_id FK
        string user_id FK
        enum event_type
        enum severity
        object data
        datetime timestamp
        datetime created_at
    }
    
    Tool {
        string id PK
        string organization_id FK
        enum tool_type
        string name
        object configuration
        enum status
        datetime created_at
        datetime updated_at
    }
```

### Multi-Tenant Data Isolation

```mermaid
graph TD
    subgraph "Application Layer"
        Request[API Request]
        TenantContext[Tenant Context]
    end
    
    subgraph "Service Layer"
        ServiceMethod[Service Method]
        TenantFilter[Tenant Filtering]
    end
    
    subgraph "Repository Layer"
        MongoQuery[MongoDB Query]
        TenantQuery[Tenant-Scoped Query]
    end
    
    subgraph "Data Layer"
        Collection[MongoDB Collection]
        TenantData[Tenant-Isolated Data]
    end
    
    Request --> TenantContext
    TenantContext --> ServiceMethod
    ServiceMethod --> TenantFilter
    TenantFilter --> MongoQuery
    MongoQuery --> TenantQuery
    TenantQuery --> Collection
    Collection --> TenantData
    
    Note1[Every query automatically<br/>includes organization_id filter]
    Note2[Ensures complete<br/>tenant data isolation]
    
    TenantFilter -.-> Note1
    TenantData -.-> Note2
```

### Pagination Strategy

OpenFrame uses cursor-based pagination for optimal performance:

```java
// Cursor pagination implementation
@Data
@Builder
public class CursorPaginationInput {
    @Min(1) @Max(100)
    private Integer limit;
    private String cursor; // Base64 encoded last item identifier
}

// Service implementation
public CountedGenericQueryResult<Device> findDevices(DeviceFilterInput input) {
    Query query = buildBaseQuery(input.getFilters());
    
    // Apply cursor if provided
    if (input.getPagination().getCursor() != null) {
        String decodedCursor = decodeCursor(input.getPagination().getCursor());
        query.addCriteria(Criteria.where("_id").gt(new ObjectId(decodedCursor)));
    }
    
    // Apply limit + 1 to check if there are more results
    query.limit(input.getPagination().getLimit() + 1);
    
    List<Device> devices = mongoTemplate.find(query, Device.class);
    
    boolean hasNext = devices.size() > input.getPagination().getLimit();
    if (hasNext) {
        devices.remove(devices.size() - 1); // Remove the extra item
    }
    
    String nextCursor = hasNext ? encodeCursor(devices.get(devices.size() - 1).getId()) : null;
    
    return CountedGenericQueryResult.<Device>builder()
        .items(devices)
        .totalCount(getTotalCount(input.getFilters()))
        .pageInfo(CursorPageInfo.builder()
            .hasNextPage(hasNext)
            .nextCursor(nextCursor)
            .build())
        .build();
}
```

## 🔐 Security Architecture

Security is built into every layer of the OpenFrame architecture.

### Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant Client as Client App
    participant Gateway as API Gateway
    participant AuthService as Auth Service
    participant API as API Service
    participant MongoDB as Database
    
    Client->>AuthService: Login Request
    AuthService->>MongoDB: Validate Credentials
    MongoDB-->>AuthService: User Data
    AuthService->>AuthService: Generate JWT
    AuthService-->>Client: JWT Token
    
    Client->>Gateway: API Request + JWT
    Gateway->>Gateway: Validate JWT Signature
    Gateway->>AuthService: Get User Details (if needed)
    AuthService-->>Gateway: User Details
    Gateway->>Gateway: Check Permissions
    Gateway->>API: Forward Request + User Context
    API->>API: Apply Tenant Filtering
    API->>MongoDB: Tenant-Scoped Query
    MongoDB-->>API: Results
    API-->>Gateway: Response
    Gateway-->>Client: Response
```

### JWT Token Structure

```javascript
// JWT Payload Example
{
  "sub": "user123",                    // User ID
  "email": "user@example.com",         // User email
  "org_id": "org456",                  // Organization ID (tenant)
  "roles": ["admin", "device_manager"], // User roles
  "permissions": [                     // Specific permissions
    "devices:read",
    "devices:write", 
    "organizations:read"
  ],
  "iat": 1640995200,                   // Issued at
  "exp": 1641081600,                   // Expires at
  "iss": "openframe-auth",             // Issuer
  "aud": "openframe-api"               // Audience
}
```

## ⚡ Performance Considerations

### Caching Strategy

```mermaid
graph TD
    subgraph "Cache Layers"
        L1[Application Cache<br/>In-memory caching]
        L2[Redis Cache<br/>Distributed caching]
        L3[Database Cache<br/>MongoDB internal]
    end
    
    subgraph "Cache Patterns"
        ReadThrough[Read-through<br/>Cache miss loads from DB]
        WriteBack[Write-back<br/>Async DB updates]
        CacheAside[Cache-aside<br/>App manages cache]
    end
    
    API[API Service] --> L1
    L1 --> L2
    L2 --> L3
    L3 --> Database[(MongoDB)]
    
    L1 -.-> ReadThrough
    L2 -.-> WriteBack
    API -.-> CacheAside
    
    style L1 fill:#e1f5fe
    style L2 fill:#f3e5f5
    style Database fill:#e8f5e8
```

### Database Optimization

- **Indexes**: Strategic indexing on query patterns
- **Aggregation**: MongoDB aggregation pipelines for complex operations
- **Connection Pooling**: Optimized connection management
- **Read Replicas**: Separate read/write operations for scaling

### Key Performance Metrics

| Metric | Target | Monitoring |
|--------|--------|------------|
| **API Response Time** | < 200ms (95th percentile) | Application metrics |
| **Database Query Time** | < 50ms (average) | MongoDB profiling |
| **Cache Hit Rate** | > 90% | Redis monitoring |
| **Memory Usage** | < 80% of available | JVM metrics |

## 🔄 Integration Architecture

OpenFrame integrates with various MSP tools through a unified integration framework.

### Tool Integration Pattern

```mermaid
graph TB
    subgraph "OpenFrame Core"
        ClientService[Client Service]
        StreamService[Stream Service]
        EventProcessor[Event Processor]
    end
    
    subgraph "Tool SDKs"
        TacticalSDK[TacticalRMM SDK]
        FleetSDK[Fleet MDM SDK]
        MeshSDK[MeshCentral SDK]
    end
    
    subgraph "External Tools"
        TacticalRMM[(TacticalRMM)]
        FleetMDM[(Fleet MDM)]
        MeshCentral[(MeshCentral)]
    end
    
    ClientService --> TacticalSDK
    ClientService --> FleetSDK
    ClientService --> MeshSDK
    
    TacticalSDK <--> TacticalRMM
    FleetSDK <--> FleetMDM
    MeshSDK <--> MeshCentral
    
    TacticalSDK --> StreamService
    FleetSDK --> StreamService
    MeshSDK --> StreamService
    
    StreamService --> EventProcessor
    
    style ClientService fill:#e1f5fe
    style StreamService fill:#f3e5f5
    style EventProcessor fill:#e8f5e8
```

## 📊 Monitoring & Observability

### Application Metrics

```mermaid
graph TD
    subgraph "Metrics Collection"
        AppMetrics[Application Metrics]
        JVMMetrics[JVM Metrics]
        CustomMetrics[Custom Business Metrics]
    end
    
    subgraph "Monitoring Stack"
        Prometheus[Prometheus]
        Grafana[Grafana]
        AlertManager[Alert Manager]
    end
    
    subgraph "Logging"
        AppLogs[Application Logs]
        AccessLogs[Access Logs]
        ErrorLogs[Error Logs]
    end
    
    AppMetrics --> Prometheus
    JVMMetrics --> Prometheus
    CustomMetrics --> Prometheus
    
    Prometheus --> Grafana
    Prometheus --> AlertManager
    
    AppLogs --> LogAggregation[Log Aggregation]
    AccessLogs --> LogAggregation
    ErrorLogs --> LogAggregation
    
    style Prometheus fill:#e1f5fe
    style Grafana fill:#f3e5f5
    style LogAggregation fill:#e8f5e8
```

## 🚀 Deployment Architecture

### Microservices Deployment

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Application Load Balancer]
    end
    
    subgraph "API Gateway Cluster"
        GW1[Gateway Instance 1]
        GW2[Gateway Instance 2]
    end
    
    subgraph "Service Clusters"
        API1[API Service 1]
        API2[API Service 2]
        AUTH1[Auth Service 1]
        AUTH2[Auth Service 2]
        CLIENT1[Client Service 1]
        CLIENT2[Client Service 2]
    end
    
    subgraph "Data Layer"
        MongoDB[(MongoDB Cluster)]
        Redis[(Redis Cluster)]
        Kafka[(Kafka Cluster)]
    end
    
    LB --> GW1
    LB --> GW2
    
    GW1 --> API1
    GW1 --> AUTH1
    GW1 --> CLIENT1
    GW2 --> API2
    GW2 --> AUTH2
    GW2 --> CLIENT2
    
    API1 --> MongoDB
    API2 --> MongoDB
    AUTH1 --> MongoDB
    AUTH2 --> MongoDB
    CLIENT1 --> MongoDB
    CLIENT2 --> MongoDB
    
    API1 --> Redis
    API2 --> Redis
    GW1 --> Redis
    GW2 --> Redis
    
    CLIENT1 --> Kafka
    CLIENT2 --> Kafka
    
    style LB fill:#e1f5fe
    style MongoDB fill:#e8f5e8
    style Redis fill:#f3e5f5
    style Kafka fill:#fff3e0
```

## 🎯 Key Architectural Decisions

### Decision 1: Cursor-Based Pagination
**Why**: Better performance for large datasets, consistent results during real-time updates
**Trade-offs**: More complex implementation vs. better scalability

### Decision 2: MongoDB as Primary Database  
**Why**: Document model fits MSP data, built-in multi-tenancy support, ACID transactions
**Trade-offs**: NoSQL learning curve vs. flexible schema evolution

### Decision 3: Microservices Architecture
**Why**: Independent scaling, technology flexibility, clear service boundaries
**Trade-offs**: Operational complexity vs. development velocity

### Decision 4: JWT for Authentication
**Why**: Stateless, scalable, standard-compliant
**Trade-offs**: Token size vs. no server-side session storage

### Decision 5: Event-Driven Integration
**Why**: Loose coupling, scalability, real-time processing
**Trade-offs**: Eventual consistency vs. system resilience

## 📚 Further Reading

- **[Local Development Setup](../setup/local-development.md)** - Get the architecture running locally
- **[Testing Overview](../testing/overview.md)** - Test architectural patterns
- **[Contributing Guidelines](../contributing/guidelines.md)** - Architectural contribution standards

---

Understanding this architecture will enable you to:
- **Navigate the codebase** efficiently
- **Make architectural decisions** consistent with the system design
- **Implement new features** following established patterns
- **Debug issues** by understanding data flow
- **Scale components** based on architectural constraints

Ready to dive deeper? Start with the [Testing Overview](../testing/overview.md) to see these patterns in action!