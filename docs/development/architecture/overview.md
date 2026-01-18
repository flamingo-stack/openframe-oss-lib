# Architecture Overview

OpenFrame OSS Library is built with a modular, microservice-ready architecture that supports multi-tenant SaaS applications. This guide provides a comprehensive overview of the system architecture, design patterns, and core components.

## High-Level Architecture

### System Overview

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web Dashboard]
        MOBILE[Mobile Apps]
        CLI[CLI Tools]
        API[External APIs]
    end
    
    subgraph "API Gateway Layer"
        GATEWAY[API Gateway]
        LB[Load Balancer]
    end
    
    subgraph "Service Layer"
        AUTH[Auth Service]
        DEVICE[Device Service]
        ORG[Organization Service]
        EVENT[Event Service]
        TOOL[Tool Service]
    end
    
    subgraph "Data Layer"
        MONGO[(MongoDB)]
        REDIS[(Redis Cache)]
        KAFKA[Event Stream]
    end
    
    subgraph "External Integrations"
        RMM[RMM Tools]
        SSO[SSO Providers]
        MONITORING[Monitoring]
    end
    
    WEB --> GATEWAY
    MOBILE --> GATEWAY
    CLI --> GATEWAY
    API --> GATEWAY
    
    GATEWAY --> AUTH
    GATEWAY --> DEVICE
    GATEWAY --> ORG
    GATEWAY --> EVENT
    GATEWAY --> TOOL
    
    AUTH --> MONGO
    DEVICE --> MONGO
    ORG --> MONGO
    EVENT --> MONGO
    TOOL --> MONGO
    
    AUTH --> REDIS
    DEVICE --> REDIS
    
    EVENT --> KAFKA
    
    TOOL --> RMM
    AUTH --> SSO
    EVENT --> MONITORING
```

### Core Design Principles

1. **Multi-Tenant by Design** - Complete tenant isolation at all levels
2. **Event-Driven Architecture** - Asynchronous communication via events
3. **Domain-Driven Design** - Clear domain boundaries and models
4. **CQRS Pattern** - Separate read/write operations for scalability
5. **API-First** - All functionality exposed through well-defined APIs

## Module Architecture

### Core Modules Structure

```mermaid
graph TB
    subgraph "API Layer Modules"
        API_LIB[openframe-api-lib]
        API_SERVICE[openframe-api-service-core]
        EXT_API[openframe-external-api-service-core]
    end
    
    subgraph "Service Modules"
        AUTH_SERVICE[openframe-authorization-service-core]
        CLIENT_SERVICE[openframe-client-core]
        MGMT_SERVICE[openframe-management-service-core]
        STREAM_SERVICE[openframe-stream-service-core]
    end
    
    subgraph "Data Modules"
        DATA_MONGO[openframe-data-mongo]
        DATA_KAFKA[openframe-data-kafka]
        DATA_CORE[openframe-data]
    end
    
    subgraph "Infrastructure Modules"
        SECURITY[openframe-security-core]
        GATEWAY[openframe-gateway-service-core]
        CONFIG[openframe-config-core]
        CORE[openframe-core]
    end
    
    subgraph "SDK Modules"
        SDK_FLEET[sdk/fleetmdm]
        SDK_TACTICAL[sdk/tacticalrmm]
    end
    
    API_LIB --> DATA_MONGO
    API_SERVICE --> API_LIB
    API_SERVICE --> SECURITY
    AUTH_SERVICE --> SECURITY
    CLIENT_SERVICE --> DATA_MONGO
    MGMT_SERVICE --> DATA_CORE
    STREAM_SERVICE --> DATA_KAFKA
    
    GATEWAY --> SECURITY
    EXT_API --> API_LIB
```

### Module Responsibilities

| Module | Purpose | Key Components |
|--------|---------|----------------|
| **api-lib** | Shared DTOs and interfaces | Device, Organization, Event DTOs |
| **api-service-core** | Main API implementation | Controllers, Services, GraphQL |
| **authorization-service-core** | Authentication & OAuth | JWT, SSO, User management |
| **client-core** | Client device management | Agent registration, Tool installation |
| **data-mongo** | MongoDB entities and repos | Documents, Repositories, Services |
| **security-core** | Security framework | JWT handling, OAuth, RBAC |
| **gateway-service-core** | API gateway functions | Rate limiting, Routing, Auth |
| **stream-service-core** | Event processing | Kafka consumers, Stream processing |

## Data Architecture

### Domain Model Overview

```mermaid
erDiagram
    Tenant ||--o{ Organization : contains
    Organization ||--o{ User : has
    Organization ||--o{ Device : manages
    Organization ||--o{ Tool : uses
    
    User ||--o{ Event : creates
    Device ||--o{ Event : generates
    Device ||--o{ InstalledAgent : runs
    
    Tool ||--o{ ToolConnection : establishes
    ToolConnection ||--o{ InstalledAgent : manages
    
    Event ||--o{ LogEvent : contains
    Device ||--o{ DeviceHealth : monitors
    Device ||--o{ SecurityState : tracks
    
    Organization {
        string id PK
        string name
        string slug UK
        string tenantId FK
        timestamp createdAt
        ContactInformation contactInfo
        Address address
    }
    
    Device {
        string id PK
        string machineId UK
        string organizationId FK
        string serialNumber
        DeviceType type
        DeviceStatus status
        timestamp lastCheckin
        DeviceHealth health
        SecurityState security
    }
    
    User {
        string id PK
        string organizationId FK
        string email UK
        UserStatus status
        timestamp lastLogin
        Set roles
    }
    
    Tool {
        string id PK
        string organizationId FK
        ToolType type
        string name
        ToolCredentials credentials
        ConnectionStatus status
    }
```

### Database Design Patterns

#### 1. Multi-Tenant Data Isolation

```mermaid
graph TB
    subgraph "Tenant A Data"
        A_ORG[Organizations A]
        A_DEVICES[Devices A]
        A_USERS[Users A]
        A_EVENTS[Events A]
    end
    
    subgraph "Tenant B Data"
        B_ORG[Organizations B]
        B_DEVICES[Devices B]
        B_USERS[Users B]
        B_EVENTS[Events B]
    end
    
    subgraph "Shared Infrastructure"
        MONGO[(MongoDB)]
        INDEXES[Compound Indexes]
    end
    
    A_ORG --> MONGO
    A_DEVICES --> MONGO
    A_USERS --> MONGO
    A_EVENTS --> MONGO
    
    B_ORG --> MONGO
    B_DEVICES --> MONGO
    B_USERS --> MONGO
    B_EVENTS --> MONGO
    
    MONGO --> INDEXES
```

**Tenant Isolation Strategy:**
- All documents include `organizationId` field
- Compound indexes: `(organizationId, field1, field2)`
- Automatic tenant filtering in queries
- No cross-tenant data access possible

#### 2. Event Sourcing for Audit Trail

```mermaid
sequenceDiagram
    participant User
    participant API
    participant Service
    participant EventStore
    participant ReadModel
    
    User->>API: Update Device Status
    API->>Service: Process Command
    Service->>EventStore: Store Event
    EventStore->>ReadModel: Project Event
    Service-->>API: Command Result
    API-->>User: Response
    
    Note over EventStore: DeviceStatusChanged Event
    Note over ReadModel: Updated Device View
```

### Caching Strategy

#### Redis Cache Architecture

```mermaid
graph LR
    subgraph "Application Layer"
        API[API Request]
    end
    
    subgraph "Cache Layer"
        REDIS[(Redis)]
        L1[L1 Cache - Application]
        L2[L2 Cache - Redis]
    end
    
    subgraph "Data Layer"
        MONGO[(MongoDB)]
    end
    
    API --> L1
    L1 -->|Cache Miss| L2
    L2 -->|Cache Miss| MONGO
    
    MONGO -->|Store| L2
    L2 -->|Store| L1
    L1 -->|Response| API
```

**Cache Patterns:**
- **User Sessions** - JWT token validation cache
- **Organization Data** - Frequently accessed org info
- **Device Status** - Real-time device state cache
- **API Rate Limits** - Request counting and throttling

## Security Architecture

### Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant AuthService
    participant ResourceAPI
    participant Database
    
    Client->>Gateway: Request + JWT
    Gateway->>AuthService: Validate Token
    AuthService->>Database: Verify User/Org
    Database-->>AuthService: User Details
    AuthService-->>Gateway: Auth Context
    Gateway->>ResourceAPI: Authorized Request
    ResourceAPI->>Database: Query with Tenant Filter
    Database-->>ResourceAPI: Tenant Data Only
    ResourceAPI-->>Gateway: Response
    Gateway-->>Client: Filtered Response
```

### Security Layers

#### 1. API Gateway Security

```mermaid
graph TB
    subgraph "Security Filters"
        CORS[CORS Filter]
        RATE[Rate Limiting]
        JWT[JWT Validation]
        TENANT[Tenant Context]
        RBAC[Role-Based Access]
    end
    
    subgraph "Request Pipeline"
        REQUEST[Incoming Request]
        RESPONSE[Outgoing Response]
    end
    
    REQUEST --> CORS
    CORS --> RATE
    RATE --> JWT
    JWT --> TENANT
    TENANT --> RBAC
    RBAC --> RESPONSE
```

#### 2. Multi-Tenant Security Model

```mermaid
graph TB
    subgraph "Tenant A"
        A_ADMIN[Admin User A]
        A_USER[Regular User A]
        A_DATA[Tenant A Data]
    end
    
    subgraph "Tenant B"
        B_ADMIN[Admin User B]
        B_USER[Regular User B]
        B_DATA[Tenant B Data]
    end
    
    subgraph "Security Boundary"
        FILTER[Tenant Filter]
        AUTH[Authorization Service]
    end
    
    A_ADMIN --> AUTH
    A_USER --> AUTH
    B_ADMIN --> AUTH
    B_USER --> AUTH
    
    AUTH --> FILTER
    FILTER --> A_DATA
    FILTER --> B_DATA
    
    A_ADMIN -.->|No Access| B_DATA
    B_ADMIN -.->|No Access| A_DATA
```

## Event-Driven Architecture

### Event Processing Pipeline

```mermaid
graph LR
    subgraph "Event Sources"
        API[API Changes]
        DEVICE[Device Events]
        USER[User Actions]
        TOOL[Tool Integration]
    end
    
    subgraph "Event Processing"
        KAFKA[Kafka Streams]
        PROCESSOR[Event Processors]
        ENRICHER[Data Enrichment]
    end
    
    subgraph "Event Consumers"
        AUDIT[Audit Service]
        NOTIFICATION[Notifications]
        ANALYTICS[Analytics]
        WEBHOOK[Webhooks]
    end
    
    API --> KAFKA
    DEVICE --> KAFKA
    USER --> KAFKA
    TOOL --> KAFKA
    
    KAFKA --> PROCESSOR
    PROCESSOR --> ENRICHER
    
    ENRICHER --> AUDIT
    ENRICHER --> NOTIFICATION
    ENRICHER --> ANALYTICS
    ENRICHER --> WEBHOOK
```

### Event Types & Schema

#### Core Event Schema

```java
public class EventBase {
    private String id;
    private String tenantId;
    private String organizationId;
    private String userId;
    private EventType type;
    private Instant timestamp;
    private String source;
    private Map<String, Object> payload;
    private Map<String, String> metadata;
}
```

#### Event Categories

| Category | Examples | Purpose |
|----------|----------|---------|
| **Device Events** | `DEVICE_REGISTERED`, `DEVICE_STATUS_CHANGED` | Device lifecycle tracking |
| **User Events** | `USER_LOGIN`, `USER_PERMISSION_CHANGED` | User activity auditing |
| **Organization Events** | `ORG_CREATED`, `ORG_SETTINGS_UPDATED` | Tenant management |
| **Tool Events** | `TOOL_CONNECTED`, `TOOL_SYNC_COMPLETED` | Integration monitoring |
| **Security Events** | `AUTHENTICATION_FAILED`, `PERMISSION_DENIED` | Security auditing |

## API Design Patterns

### RESTful API Design

#### Resource Naming Conventions

```text
# Organizations
GET    /api/organizations                    # List organizations
POST   /api/organizations                    # Create organization
GET    /api/organizations/{id}               # Get organization
PUT    /api/organizations/{id}               # Update organization
DELETE /api/organizations/{id}               # Delete organization

# Nested Resources
GET    /api/organizations/{id}/devices       # List org devices
GET    /api/organizations/{id}/users         # List org users
POST   /api/organizations/{id}/users         # Add user to org

# Device Management
GET    /api/devices                          # List all devices
GET    /api/devices/{id}                     # Get device details
POST   /api/devices                          # Register device
PATCH  /api/devices/{id}/status              # Update device status
GET    /api/devices/{id}/health              # Get device health
```

#### Response Format Standards

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": "device-123",
    "name": "Production Server",
    "status": "ACTIVE",
    "lastCheckin": "2024-01-15T10:30:00Z"
  },
  "pagination": {
    "hasNext": true,
    "cursor": "eyJpZCI6ImRldmljZS0xMjMifQ==",
    "limit": 20
  },
  "meta": {
    "total": 150,
    "took": 45,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid device configuration",
    "details": [
      {
        "field": "serialNumber",
        "message": "Serial number is required",
        "rejectedValue": null
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-abc-123"
  }
}
```

### GraphQL API Design

#### Schema Structure

```graphql
type Query {
  # Organizations
  organization(id: ID!): Organization
  organizations(filter: OrganizationFilter, pagination: CursorInput): OrganizationConnection
  
  # Devices
  device(id: ID!): Device
  devices(filter: DeviceFilter, pagination: CursorInput): DeviceConnection
  
  # Events
  events(filter: EventFilter, pagination: CursorInput): EventConnection
}

type Mutation {
  # Device Management
  createDevice(input: CreateDeviceInput!): DevicePayload
  updateDevice(id: ID!, input: UpdateDeviceInput!): DevicePayload
  updateDeviceStatus(id: ID!, status: DeviceStatus!): DevicePayload
  
  # Organization Management
  createOrganization(input: CreateOrganizationInput!): OrganizationPayload
  updateOrganization(id: ID!, input: UpdateOrganizationInput!): OrganizationPayload
}

type Subscription {
  # Real-time updates
  deviceStatusUpdated(organizationId: ID): Device
  eventCreated(organizationId: ID, types: [EventType!]): Event
}
```

## Integration Architecture

### External Tool Integration

```mermaid
graph TB
    subgraph "OpenFrame Core"
        API[REST API]
        SERVICE[Tool Service]
        REGISTRY[Tool Registry]
    end
    
    subgraph "Integration Layer"
        SDK[Tool SDKs]
        ADAPTER[Protocol Adapters]
        CONNECTOR[Connection Manager]
    end
    
    subgraph "External Tools"
        FLEET[Fleet MDM]
        TACTICAL[Tactical RMM]
        MESH[MeshCentral]
        CUSTOM[Custom Tools]
    end
    
    API --> SERVICE
    SERVICE --> REGISTRY
    REGISTRY --> SDK
    
    SDK --> ADAPTER
    ADAPTER --> CONNECTOR
    
    CONNECTOR --> FLEET
    CONNECTOR --> TACTICAL
    CONNECTOR --> MESH
    CONNECTOR --> CUSTOM
```

### Integration Patterns

#### 1. SDK-Based Integration

```java
@Component
public class FleetMdmIntegration {
    
    private final FleetMdmClient client;
    
    public List<Device> syncDevices(String organizationId) {
        FleetCredentials creds = getCredentials(organizationId);
        return client.getHosts(creds).stream()
                    .map(this::mapToDevice)
                    .collect(Collectors.toList());
    }
}
```

#### 2. Event-Based Integration

```java
@EventListener
public void handleToolEvent(IntegratedToolEvent event) {
    switch (event.getType()) {
        case DEVICE_UPDATED:
            syncDeviceFromTool(event);
            break;
        case AGENT_INSTALLED:
            registerNewAgent(event);
            break;
    }
}
```

## Performance Architecture

### Scalability Patterns

#### Horizontal Scaling

```mermaid
graph TB
    subgraph "Load Balancers"
        LB[Load Balancer]
        ALB[Application Load Balancer]
    end
    
    subgraph "Application Instances"
        APP1[App Instance 1]
        APP2[App Instance 2]
        APP3[App Instance 3]
    end
    
    subgraph "Data Tier"
        MONGO_PRIMARY[(MongoDB Primary)]
        MONGO_SECONDARY1[(MongoDB Secondary 1)]
        MONGO_SECONDARY2[(MongoDB Secondary 2)]
        REDIS_CLUSTER[Redis Cluster]
    end
    
    LB --> ALB
    ALB --> APP1
    ALB --> APP2
    ALB --> APP3
    
    APP1 --> MONGO_PRIMARY
    APP1 --> REDIS_CLUSTER
    APP2 --> MONGO_PRIMARY
    APP2 --> REDIS_CLUSTER
    APP3 --> MONGO_PRIMARY
    APP3 --> REDIS_CLUSTER
    
    MONGO_PRIMARY --> MONGO_SECONDARY1
    MONGO_PRIMARY --> MONGO_SECONDARY2
```

#### Database Optimization

**Index Strategy:**
```javascript
// Compound indexes for multi-tenant queries
db.devices.createIndex({ 
  "organizationId": 1, 
  "status": 1, 
  "lastCheckin": -1 
});

// Text search index
db.devices.createIndex({ 
  "name": "text", 
  "model": "text", 
  "serialNumber": "text" 
});

// Geospatial index for location-based queries
db.devices.createIndex({ "location": "2dsphere" });
```

**Query Optimization:**
```java
// Efficient pagination with cursor
public PageResponse<Device> getDevices(CursorPaginationInput pagination) {
    Criteria criteria = Criteria.where("organizationId").is(orgId);
    
    if (pagination.getCursor() != null) {
        criteria.and("id").gt(decodeCursor(pagination.getCursor()));
    }
    
    Query query = Query.query(criteria)
                      .limit(pagination.getLimit() + 1)
                      .with(Sort.by("id"));
    
    List<Device> devices = mongoTemplate.find(query, Device.class);
    return buildPageResponse(devices, pagination.getLimit());
}
```

## Monitoring & Observability

### Observability Stack

```mermaid
graph TB
    subgraph "Application Metrics"
        MICROMETER[Micrometer]
        ACTUATOR[Spring Boot Actuator]
        CUSTOM[Custom Metrics]
    end
    
    subgraph "Monitoring Tools"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        JAEGER[Jaeger Tracing]
    end
    
    subgraph "Alerting"
        ALERTMANAGER[AlertManager]
        PAGERDUTY[PagerDuty]
        SLACK[Slack Alerts]
    end
    
    MICROMETER --> PROMETHEUS
    ACTUATOR --> PROMETHEUS
    CUSTOM --> PROMETHEUS
    
    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTMANAGER
    
    ALERTMANAGER --> PAGERDUTY
    ALERTMANAGER --> SLACK
```

### Key Metrics

| Metric Category | Examples | Purpose |
|----------------|----------|---------|
| **Application** | Request rate, Response time, Error rate | Performance monitoring |
| **Business** | Active devices, Organizations, Events/hour | Business insights |
| **Infrastructure** | CPU, Memory, Disk, Network | Resource monitoring |
| **Database** | Query time, Connection pool, Index usage | Database performance |
| **Security** | Failed logins, Permission denials, API abuse | Security monitoring |

## Key Design Decisions

### 1. **MongoDB for Primary Storage**
- **Why**: Document-based model fits domain objects well
- **Trade-offs**: No ACID transactions across collections
- **Mitigation**: Event sourcing for consistency

### 2. **JWT for Authentication**
- **Why**: Stateless, scalable, standard
- **Trade-offs**: Token revocation complexity
- **Mitigation**: Short expiration + refresh tokens

### 3. **Cursor-based Pagination**
- **Why**: Consistent performance, no offset issues
- **Trade-offs**: No random page access
- **Mitigation**: Search functionality for discovery

### 4. **Event-Driven Architecture**
- **Why**: Loose coupling, scalability, audit trail
- **Trade-offs**: Eventual consistency, complexity
- **Mitigation**: Careful event design, monitoring

## Next Steps

Now that you understand the architecture, explore specific areas:

1. **[API Design Patterns](../api/design-patterns.md)** - Learn API conventions
2. **[Testing Architecture](../testing/overview.md)** - Understand testing strategy  
3. **[Security Implementation](../../reference/architecture/security_core_config.md)** - Dive into security details
4. **[Performance Optimization](../performance/optimization.md)** - Learn performance best practices

## Resources

- 📚 **API Reference**: [Complete API Documentation](../../reference/architecture/overview.md)
- 💬 **Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- 🚀 **Platform**: [OpenFrame.ai](https://openframe.ai)

This architecture provides the foundation for building scalable, secure, and maintainable device management platforms with OpenFrame OSS Library! 🏗️