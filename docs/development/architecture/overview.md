# Architecture Overview

OpenFrame OSS Library is designed as a comprehensive, modular foundation for building secure, scalable device and organization management platforms. This guide provides a deep dive into the system architecture, design patterns, and key architectural decisions.

## High-Level Architecture

### System Overview

```mermaid
graph TB
    subgraph "External Clients"
        WEB[Web Dashboard]
        MOBILE[Mobile Apps]
        CLI[CLI Tools]
        API_CLIENT[External APIs]
    end
    
    subgraph "OpenFrame Platform"
        GATEWAY[Gateway Service]
        
        subgraph "Core Services"
            AUTH[Authorization Service]
            API[API Service]
            MGMT[Management Service]
            STREAM[Stream Service]
        end
        
        subgraph "OpenFrame OSS Library"
            DTOs[API DTOs]
            SERVICES[Service Interfaces]
            DATA[Data Models]
            SECURITY[Security Components]
            UTILS[Utilities & Config]
        end
    end
    
    subgraph "Data Layer"
        MONGO[(MongoDB)]
        REDIS[(Redis Cache)]
        KAFKA[Kafka Streams]
        CASSANDRA[(Cassandra Logs)]
    end
    
    subgraph "External Integrations"
        FLEET[Fleet MDM]
        TACTICAL[Tactical RMM]
        MESH[MeshCentral]
        OIDC[OIDC Providers]
    end
    
    WEB --> GATEWAY
    MOBILE --> GATEWAY
    CLI --> GATEWAY
    API_CLIENT --> GATEWAY
    
    GATEWAY --> AUTH
    GATEWAY --> API
    
    AUTH --> DTOs
    API --> SERVICES
    MGMT --> DATA
    STREAM --> UTILS
    
    SERVICES --> MONGO
    DATA --> MONGO
    SECURITY --> REDIS
    
    STREAM --> KAFKA
    STREAM --> CASSANDRA
    
    API --> FLEET
    API --> TACTICAL
    API --> MESH
    AUTH --> OIDC
```

### Architectural Principles

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Modularity** | Loosely coupled, highly cohesive components | Separate modules for DTOs, services, data models |
| **Multi-Tenancy** | Secure tenant isolation | Tenant-scoped data access and security contexts |
| **Scalability** | Horizontal scaling capabilities | Stateless services, cursor pagination, caching |
| **Security** | Security by design | JWT authentication, role-based access, audit trails |
| **Extensibility** | Plugin architecture for integrations | Interface-based design, dependency injection |
| **Observability** | Comprehensive monitoring and logging | Structured logging, metrics, health checks |

## Core Components Architecture

### 1. API Layer Architecture

The API layer provides standardized interfaces and data transfer objects.

```mermaid
graph LR
    subgraph "API Layer"
        CONTROLLER[Controllers]
        VALIDATOR[Validation]
        MAPPER[Mappers]
        DTO[DTOs]
    end
    
    subgraph "Service Layer"
        BUSINESS[Business Logic]
        ORCHESTRATION[Service Orchestration]
        INTEGRATION[External Integration]
    end
    
    subgraph "Data Layer"
        REPOSITORY[Repositories]
        ENTITY[Entities]
        CACHE[Caching]
    end
    
    CONTROLLER --> VALIDATOR
    VALIDATOR --> MAPPER
    MAPPER --> DTO
    DTO --> BUSINESS
    BUSINESS --> ORCHESTRATION
    ORCHESTRATION --> INTEGRATION
    BUSINESS --> REPOSITORY
    REPOSITORY --> ENTITY
    REPOSITORY --> CACHE
```

#### Key API Components

**Controllers** (`openframe-api-service-core`)
```java
@RestController
@RequestMapping("/api/devices")
public class DeviceController {
    
    @PostMapping("/search")
    public ResponseEntity<GenericQueryResult<DeviceResponse>> searchDevices(
        @Valid @RequestBody DeviceFilterInput filter) {
        
        GenericQueryResult<DeviceResponse> result = deviceService.searchDevices(filter);
        return ResponseEntity.ok(result);
    }
}
```

**DTOs** (`openframe-api-lib`)
```java
// Input DTO for API requests
public class DeviceFilterInput {
    @Valid
    private List<String> types;
    
    @Valid
    private CursorPaginationInput pagination;
    
    private String organizationId;
}

// Response DTO for API responses
public class DeviceResponse {
    private String id;
    private String serialNumber;
    private String model;
    private DeviceType type;
    private String status;
    private Instant lastCheckin;
}
```

### 2. Service Layer Architecture

The service layer contains business logic and orchestrates operations.

```mermaid
graph TB
    subgraph "Service Interfaces (openframe-api-lib)"
        IDS[DeviceService]
        IOS[OrganizationService] 
        IES[EventService]
        ITS[ToolService]
    end
    
    subgraph "Service Implementation (openframe-api-service-core)"
        DS[DeviceServiceImpl]
        OS[OrganizationServiceImpl]
        ES[EventServiceImpl] 
        TS[ToolServiceImpl]
    end
    
    subgraph "Data Access"
        DR[DeviceRepository]
        OR[OrganizationRepository]
        ER[EventRepository]
        TR[ToolRepository]
    end
    
    IDS --> DS
    IOS --> OS
    IES --> ES
    ITS --> TS
    
    DS --> DR
    OS --> OR
    ES --> ER
    TS --> TR
```

#### Service Implementation Pattern

```java
@Service
@Transactional
public class DeviceServiceImpl implements DeviceService {
    
    private final DeviceRepository deviceRepository;
    private final DeviceMapper deviceMapper;
    private final EventService eventService;
    
    @Override
    public GenericQueryResult<DeviceResponse> searchDevices(DeviceFilterInput filter) {
        // 1. Convert DTO to query criteria
        DeviceQueryFilter queryFilter = deviceMapper.toQueryFilter(filter);
        
        // 2. Execute repository query
        GenericQueryResult<Device> devices = deviceRepository.findWithFilter(queryFilter);
        
        // 3. Map entities to response DTOs
        List<DeviceResponse> responses = deviceMapper.toResponseDTOs(devices.getItems());
        
        // 4. Create audit event
        eventService.logDeviceQuery(filter, responses.size());
        
        // 5. Return paginated result
        return GenericQueryResult.<DeviceResponse>builder()
            .items(responses)
            .pageInfo(devices.getPageInfo())
            .build();
    }
}
```

### 3. Data Layer Architecture

The data layer manages persistence and caching with MongoDB as primary storage.

```mermaid
graph TB
    subgraph "Data Models (openframe-data-mongo)"
        DEVICE[Device]
        ORG[Organization]
        EVENT[Event]
        TOOL[Tool]
        USER[User]
    end
    
    subgraph "Repository Layer"
        DEVICE_REPO[DeviceRepository]
        ORG_REPO[OrganizationRepository]
        EVENT_REPO[EventRepository]
        TOOL_REPO[ToolRepository]
        USER_REPO[UserRepository]
    end
    
    subgraph "Database Layer"
        MONGO[(MongoDB Collections)]
        REDIS[(Redis Cache)]
        INDEX[Database Indexes]
    end
    
    DEVICE --> DEVICE_REPO
    ORG --> ORG_REPO
    EVENT --> EVENT_REPO
    TOOL --> TOOL_REPO
    USER --> USER_REPO
    
    DEVICE_REPO --> MONGO
    ORG_REPO --> MONGO
    EVENT_REPO --> MONGO
    TOOL_REPO --> MONGO
    USER_REPO --> MONGO
    
    DEVICE_REPO --> REDIS
    ORG_REPO --> REDIS
```

#### Data Model Example

```java
@Document(collection = "devices")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Device {
    
    @Id
    private String id;
    
    @Indexed
    private String machineId;
    
    @Indexed(unique = true)
    private String serialNumber;
    
    private String model;
    private String osVersion;
    
    @Indexed
    private String status;
    
    @Indexed
    private DeviceType type;
    
    @Indexed
    private String organizationId;
    
    private Instant lastCheckin;
    private DeviceConfiguration configuration;
    private DeviceHealth health;
    
    @CreatedDate
    private Instant createdAt;
    
    @LastModifiedDate
    private Instant updatedAt;
}
```

## Multi-Tenant Architecture

### Tenant Isolation Strategy

OpenFrame implements **shared database, shared schema** multi-tenancy with data isolation.

```mermaid
graph TB
    subgraph "Tenant A - Acme Corp"
        A_USERS[Users: tenant=acme]
        A_DEVICES[Devices: organizationId=acme-*]
        A_EVENTS[Events: organizationId=acme-*]
    end
    
    subgraph "Tenant B - Beta Inc"
        B_USERS[Users: tenant=beta]
        B_DEVICES[Devices: organizationId=beta-*]
        B_EVENTS[Events: organizationId=beta-*]
    end
    
    subgraph "Shared MongoDB"
        USERS_COLL[users collection]
        DEVICES_COLL[devices collection]
        EVENTS_COLL[events collection]
        ORGS_COLL[organizations collection]
    end
    
    A_USERS --> USERS_COLL
    A_DEVICES --> DEVICES_COLL
    A_EVENTS --> EVENTS_COLL
    
    B_USERS --> USERS_COLL
    B_DEVICES --> DEVICES_COLL
    B_EVENTS --> EVENTS_COLL
```

### Tenant Context Management

```java
@Component
public class TenantContextFilter implements Filter {
    
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        
        // Extract tenant from JWT token or subdomain
        String tenantId = extractTenantId(httpRequest);
        
        try {
            // Set tenant context for current thread
            TenantContext.setCurrentTenant(tenantId);
            chain.doFilter(request, response);
        } finally {
            // Clear tenant context
            TenantContext.clear();
        }
    }
}

@Repository
public class DeviceRepository {
    
    public List<Device> findAllDevices() {
        String tenantId = TenantContext.getCurrentTenant();
        
        // Automatically add tenant filter to all queries
        return mongoTemplate.find(
            Query.query(Criteria.where("organizationId").regex("^" + tenantId + "-")),
            Device.class
        );
    }
}
```

## Security Architecture

### Authentication and Authorization Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Auth as Authorization Service
    participant API as API Service
    participant DB as Database
    
    Client->>Gateway: Request with JWT
    Gateway->>Auth: Validate JWT
    Auth->>Auth: Decode token & extract claims
    Auth-->>Gateway: Token valid + user context
    Gateway->>API: Forward request + user context
    API->>API: Check permissions
    API->>DB: Query with tenant filter
    DB-->>API: Filtered results
    API-->>Gateway: Response
    Gateway-->>Client: Response
```

### Security Components

**JWT Token Structure:**
```json
{
  "sub": "user-123",
  "email": "john@acme.com",
  "tenantId": "acme",
  "organizationIds": ["acme-org-1", "acme-org-2"],
  "roles": ["DEVICE_ADMIN", "USER_READER"],
  "iat": 1640995200,
  "exp": 1641081600
}
```

**Role-Based Access Control:**
```java
@PreAuthorize("hasRole('DEVICE_ADMIN') and @tenantChecker.canAccess(#deviceId)")
public DeviceResponse updateDevice(String deviceId, UpdateDeviceRequest request) {
    // Implementation
}

@Component
public class TenantChecker {
    
    public boolean canAccess(String resourceId) {
        String currentTenant = TenantContext.getCurrentTenant();
        String resourceTenant = extractTenantFromResourceId(resourceId);
        return currentTenant.equals(resourceTenant);
    }
}
```

## Data Flow Architecture

### Query Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Service
    participant Mapper
    participant Repository
    participant MongoDB
    participant Cache
    
    Client->>Controller: API Request
    Controller->>Service: Business Logic Call
    Service->>Mapper: Convert DTO to Filter
    Service->>Repository: Query with Filter
    Repository->>Cache: Check Cache
    alt Cache Hit
        Cache-->>Repository: Cached Result
    else Cache Miss
        Repository->>MongoDB: Execute Query
        MongoDB-->>Repository: Query Results
        Repository->>Cache: Store in Cache
    end
    Repository-->>Service: Query Results
    Service->>Mapper: Convert to Response DTOs
    Service-->>Controller: Response DTOs
    Controller-->>Client: JSON Response
```

### Event Processing Flow

```mermaid
sequenceDiagram
    participant Device
    participant API
    participant EventService
    participant MongoDB
    participant Kafka
    participant StreamProcessor
    participant Notifications
    
    Device->>API: Status Update
    API->>EventService: Create Event
    EventService->>MongoDB: Store Event
    EventService->>Kafka: Publish Event
    
    Kafka->>StreamProcessor: Process Event
    StreamProcessor->>StreamProcessor: Analyze & Enrich
    StreamProcessor->>Notifications: Send Alert
    StreamProcessor->>MongoDB: Store Analytics
```

## Pagination Architecture

### Cursor-Based Pagination Design

OpenFrame uses cursor-based pagination for consistent performance and real-time data handling.

```mermaid
graph LR
    subgraph "Pagination Flow"
        REQUEST[Client Request]
        CURSOR[Cursor Generation]
        QUERY[Database Query]
        RESULT[Paginated Result]
        METADATA[Page Metadata]
    end
    
    REQUEST --> CURSOR
    CURSOR --> QUERY
    QUERY --> RESULT
    RESULT --> METADATA
    METADATA --> REQUEST
```

#### Pagination Implementation

```java
public class CursorPaginationInput {
    private Integer first;      // Page size (forward pagination)
    private Integer last;       // Page size (backward pagination)
    private String after;       // Cursor for next page
    private String before;      // Cursor for previous page
}

public class CursorPageInfo {
    private boolean hasNextPage;
    private boolean hasPreviousPage;
    private String startCursor;
    private String endCursor;
}

// Repository implementation
public GenericQueryResult<Device> findWithPagination(CursorPaginationInput pagination) {
    Query query = new Query();
    
    // Add cursor-based filtering
    if (pagination.getAfter() != null) {
        String afterId = decodeCursor(pagination.getAfter());
        query.addCriteria(Criteria.where("id").gt(afterId));
    }
    
    // Set page size
    query.limit(pagination.getFirst() + 1); // +1 to check hasNextPage
    query.with(Sort.by(Sort.Direction.ASC, "id"));
    
    List<Device> devices = mongoTemplate.find(query, Device.class);
    
    // Build page info
    boolean hasNextPage = devices.size() > pagination.getFirst();
    if (hasNextPage) {
        devices.remove(devices.size() - 1); // Remove extra item
    }
    
    CursorPageInfo pageInfo = CursorPageInfo.builder()
        .hasNextPage(hasNextPage)
        .hasPreviousPage(pagination.getAfter() != null)
        .startCursor(encodeCursor(devices.get(0).getId()))
        .endCursor(encodeCursor(devices.get(devices.size() - 1).getId()))
        .build();
    
    return GenericQueryResult.<Device>builder()
        .items(devices)
        .pageInfo(pageInfo)
        .build();
}
```

## Integration Architecture

### External Tool Integration Pattern

```mermaid
graph TB
    subgraph "OpenFrame Core"
        TOOL_SERVICE[Tool Service]
        CREDENTIAL_MGR[Credential Manager]
        CONNECTION_MGR[Connection Manager]
    end
    
    subgraph "Integration Layer"
        SDK_FLEET[Fleet MDM SDK]
        SDK_TACTICAL[Tactical RMM SDK] 
        SDK_MESH[MeshCentral SDK]
    end
    
    subgraph "External Tools"
        FLEET[Fleet MDM]
        TACTICAL[Tactical RMM]
        MESH[MeshCentral]
    end
    
    TOOL_SERVICE --> CREDENTIAL_MGR
    CREDENTIAL_MGR --> CONNECTION_MGR
    
    CONNECTION_MGR --> SDK_FLEET
    CONNECTION_MGR --> SDK_TACTICAL
    CONNECTION_MGR --> SDK_MESH
    
    SDK_FLEET --> FLEET
    SDK_TACTICAL --> TACTICAL
    SDK_MESH --> MESH
```

#### Tool Integration Interface

```java
public interface ToolService {
    
    // Connection management
    ToolConnection createConnection(ToolConnectionRequest request);
    ToolConnection updateConnection(String connectionId, ToolConnectionRequest request);
    void deleteConnection(String connectionId);
    
    // Device synchronization
    List<Device> syncDevices(String connectionId);
    Device syncDevice(String connectionId, String deviceId);
    
    // Remote operations
    CommandResult executeCommand(String connectionId, String deviceId, String command);
    FileUploadResult uploadFile(String connectionId, String deviceId, String filePath, byte[] content);
}

@Service
public class FleetMdmToolService implements ToolService {
    
    private final FleetMdmClient fleetClient;
    private final EncryptionService encryptionService;
    
    @Override
    public List<Device> syncDevices(String connectionId) {
        ToolConnection connection = getConnection(connectionId);
        FleetCredentials credentials = decryptCredentials(connection);
        
        // Use Fleet MDM SDK
        HostSearchResponse response = fleetClient.searchHosts(credentials, HostSearchRequest.all());
        
        return response.getHosts().stream()
            .map(this::mapFleetHostToDevice)
            .collect(Collectors.toList());
    }
}
```

## Performance and Scalability

### Caching Strategy

```mermaid
graph TB
    subgraph "Cache Layers"
        APP_CACHE[Application Cache]
        REDIS_CACHE[Redis Cache]
        DB_CACHE[Database Query Cache]
    end
    
    subgraph "Cache Usage"
        SESSION[User Sessions]
        DEVICE[Device Data]
        ORG[Organization Data]
        AUTH[Authentication Data]
    end
    
    APP_CACHE --> SESSION
    REDIS_CACHE --> DEVICE
    REDIS_CACHE --> ORG
    REDIS_CACHE --> AUTH
    DB_CACHE --> DEVICE
```

#### Caching Implementation

```java
@Service
@CacheConfig(cacheNames = "devices")
public class DeviceService {
    
    @Cacheable(key = "#deviceId")
    public DeviceResponse getDevice(String deviceId) {
        // Database query only if not in cache
    }
    
    @CacheEvict(key = "#deviceId")
    public DeviceResponse updateDevice(String deviceId, UpdateDeviceRequest request) {
        // Evict cache after update
    }
    
    @CachePut(key = "#result.id")
    public DeviceResponse createDevice(CreateDeviceRequest request) {
        // Put new device in cache
    }
}
```

### Database Optimization

**MongoDB Indexing Strategy:**

```java
@Document(collection = "devices")
public class Device {
    
    @Id
    private String id;
    
    @Indexed  // Single field index
    private String organizationId;
    
    @CompoundIndex(def = "{'organizationId': 1, 'status': 1}")  // Compound index
    @CompoundIndex(def = "{'organizationId': 1, 'type': 1, 'lastCheckin': -1}")
    @CompoundIndex(def = "{'serialNumber': 1}", unique = true)
    private String serialNumber;
}
```

## Error Handling and Resilience

### Exception Handling Strategy

```mermaid
graph TB
    subgraph "Exception Hierarchy"
        BASE[OpenFrameException]
        BUSINESS[BusinessException]
        TECHNICAL[TechnicalException]
        SECURITY[SecurityException]
    end
    
    subgraph "Specific Exceptions"
        NOT_FOUND[DeviceNotFoundException]
        VALIDATION[ValidationException]
        AUTH_FAILED[AuthenticationException]
        TENANT_VIOLATION[TenantViolationException]
    end
    
    BASE --> BUSINESS
    BASE --> TECHNICAL
    BASE --> SECURITY
    
    BUSINESS --> NOT_FOUND
    BUSINESS --> VALIDATION
    SECURITY --> AUTH_FAILED
    SECURITY --> TENANT_VIOLATION
```

#### Global Exception Handler

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(DeviceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleDeviceNotFound(DeviceNotFoundException ex) {
        ErrorResponse error = ErrorResponse.builder()
            .code("DEVICE_NOT_FOUND")
            .message("Device not found: " + ex.getDeviceId())
            .timestamp(Instant.now())
            .build();
        
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }
    
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidation(ValidationException ex) {
        ErrorResponse error = ErrorResponse.builder()
            .code("VALIDATION_ERROR")
            .message("Validation failed")
            .details(ex.getFieldErrors())
            .timestamp(Instant.now())
            .build();
        
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }
}
```

## Key Design Decisions

### 1. Cursor vs Offset Pagination

**Why Cursor-Based:**
- ✅ Consistent performance with large datasets
- ✅ Real-time data stability (no duplicates during concurrent updates)
- ✅ Suitable for infinite scrolling UIs
- ❌ More complex implementation
- ❌ Cannot jump to arbitrary pages

### 2. Shared Database Multi-Tenancy

**Why Shared Database:**
- ✅ Cost-effective for large number of tenants
- ✅ Easier maintenance and upgrades
- ✅ Better resource utilization
- ❌ Requires careful query filtering
- ❌ Risk of data leakage if not implemented correctly

### 3. MongoDB as Primary Database

**Why MongoDB:**
- ✅ Flexible schema for device metadata
- ✅ Excellent aggregation capabilities
- ✅ Horizontal scaling support
- ✅ JSON-native for API responses
- ❌ Eventual consistency in some scenarios
- ❌ Complex transactions across documents

### 4. Event Sourcing for Audit Logs

**Why Event Sourcing:**
- ✅ Complete audit trail
- ✅ Replay capability for debugging
- ✅ Scalable event processing
- ❌ More complex than simple logging
- ❌ Storage overhead

## Best Practices and Patterns

### Service Design Patterns

1. **Repository Pattern** - Clean separation of data access logic
2. **DTO Pattern** - Controlled data transfer between layers
3. **Builder Pattern** - Fluent object construction
4. **Strategy Pattern** - Pluggable tool integrations
5. **Observer Pattern** - Event-driven architecture

### Code Quality Standards

- **Test Coverage** - Minimum 80% line coverage
- **Documentation** - Comprehensive Javadoc
- **Code Review** - All changes peer-reviewed
- **Static Analysis** - Automated code quality checks
- **Security Scanning** - Automated vulnerability detection

## Future Architecture Considerations

### Planned Enhancements

1. **GraphQL API** - Flexible query capabilities
2. **Microservices Decomposition** - Service-specific databases
3. **Event Store** - Dedicated event sourcing database
4. **Message Queues** - Reliable async processing
5. **Service Mesh** - Advanced service communication

### Scalability Roadmap

1. **Horizontal Scaling** - Multiple service instances
2. **Database Sharding** - Tenant-based data partitioning
3. **Caching Layer** - Distributed caching with Redis Cluster
4. **CDN Integration** - Static asset delivery
5. **Auto-Scaling** - Kubernetes-based scaling

This architecture provides a solid foundation for building enterprise-grade device management solutions while maintaining flexibility for future growth and feature additions.