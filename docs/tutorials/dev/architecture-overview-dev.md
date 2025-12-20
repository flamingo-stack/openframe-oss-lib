# Architecture Overview - OpenFrame OSS Library

This document provides a comprehensive technical overview of the OpenFrame OSS Library architecture, designed for engineers working on or integrating with the system.

## High-Level System Architecture

```mermaid
flowchart TD
    subgraph "Client Layer"
        CLI[CLI Tools]
        WEB[Web Dashboard]
        API[External APIs]
    end
    
    subgraph "Service Layer"
        AUTH[Authorization Service]
        CLIENT[Client Service]
        STREAM[Stream Service]
        API_SVC[API Service]
    end
    
    subgraph "Core Library"
        DTO[API DTOs]
        FILTERS[Query Filters]
        REPOS[Repository Interfaces]
    end
    
    subgraph "External SDKs"
        FLEET[FleetMDM SDK]
        TACTICAL[TacticalRMM SDK]
    end
    
    subgraph "Data Layer"
        MONGO[(MongoDB)]
        CACHE[(Redis Cache)]
    end
    
    CLI --> AUTH
    WEB --> API_SVC
    API --> AUTH
    
    AUTH --> DTO
    CLIENT --> DTO
    STREAM --> DTO
    API_SVC --> DTO
    
    DTO --> REPOS
    FILTERS --> REPOS
    
    CLIENT --> FLEET
    CLIENT --> TACTICAL
    
    REPOS --> MONGO
    REPOS --> CACHE
    
    style DTO fill:#e1f5fe
    style AUTH fill:#f3e5f5
    style MONGO fill:#e8f5e8
```

## Core Components and Responsibilities

| Component | Responsibility | Key Classes | Dependencies |
|-----------|---------------|-------------|--------------|
| **API DTOs** | Data transfer between services | `CreateOrganizationRequest`, `DeviceFilterOptions` | Jackson, Validation |
| **Client Service** | Agent registration and management | `AgentRegistrationProcessor`, `ClientRegistrationStrategy` | API DTOs, External SDKs |
| **Authorization Service** | Authentication and OIDC | `BaseOIDCClientRegistrationStrategy` | Spring Security, OAuth2 |
| **Stream Service** | Event processing and messaging | `DeserializedDebeziumMessage` | Kafka, Debezium |
| **Repository Layer** | Data persistence abstraction | `ReactiveOrganizationRepository` | Spring Data MongoDB |
| **External SDKs** | Third-party integrations | `FleetMdmClient`, `TacticalRMMClient` | HTTP clients |

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant Client as Client Application
    participant Auth as Authorization Service
    participant API as API Service
    participant Filter as Query Filter
    participant Repo as Repository
    participant DB as MongoDB
    participant Stream as Stream Service
    
    Client->>Auth: 1. Authenticate Request
    Auth->>Client: 2. Return JWT Token
    
    Client->>API: 3. Create Organization Request
    API->>Filter: 4. Apply Organization Filters
    Filter->>Repo: 5. Execute Query with Filters
    Repo->>DB: 6. Store Organization Data
    DB->>Repo: 7. Return Saved Entity
    Repo->>API: 8. Return Organization Response
    
    API->>Stream: 9. Emit Organization Created Event
    Stream->>DB: 10. Store Audit Log
    
    API->>Client: 11. Return Success Response
```

## Module Architecture Deep Dive

### Module 1: Agent Registration & Client Management

```mermaid
graph TD
    subgraph "Agent Registration Module"
        ARP[Agent Registration Processor]
        CRS[Client Registration Strategy]
        DDM[Debezium Message Handler]
        HSR[Host Search Response]
    end
    
    subgraph "Registration Strategies"
        GOOGLE[Google Strategy]
        MICROSOFT[Microsoft Strategy]
        BASE[Base OIDC Strategy]
    end
    
    subgraph "Data Processing"
        FORCE[Force Update Response]
        ITEM[Response Items]
    end
    
    ARP --> CRS
    CRS --> GOOGLE
    CRS --> MICROSOFT
    CRS --> BASE
    
    ARP --> DDM
    ARP --> HSR
    ARP --> FORCE
    FORCE --> ITEM
```

**Key Design Patterns**:
- **Strategy Pattern**: `ClientRegistrationStrategy` implementations for different providers
- **Template Method**: `BaseOIDCClientRegistrationStrategy` provides common OIDC flow
- **Observer Pattern**: Debezium message processing for data changes

### Module 2-5: Data Management and Filtering

```mermaid
graph LR
    subgraph "Query Layer"
        QF[Query Filters]
        OF[Organization Filters]
        DF[Device Filters]
        EF[Event Filters]
    end
    
    subgraph "Repository Layer"
        ROR[Reactive Org Repository]
        RDR[Reactive Device Repository]
        RER[Reactive Event Repository]
    end
    
    subgraph "Response DTOs"
        GQR[Generic Query Result]
        CGQR[Counted Generic Query Result]
        OL[Organization List]
    end
    
    QF --> OF
    QF --> DF
    QF --> EF
    
    OF --> ROR
    DF --> RDR
    EF --> RER
    
    ROR --> GQR
    RDR --> CGQR
    RER --> OL
```

**Key Design Patterns**:
- **Builder Pattern**: All filter options use builder pattern for flexible configuration
- **Generic Types**: `GenericQueryResult<T>` provides type-safe query responses
- **Reactive Programming**: All repositories use Spring WebFlux reactive patterns

### Modules 6-9: Tool Management and Force Operations

```mermaid
graph TD
    subgraph "Force Operations"
        FTI[Force Tool Installation]
        FTU[Force Tool Update]
        FTIA[Force Tool Install All]
    end
    
    subgraph "Response Processing"
        FTIR[Force Tool Installation Response]
        FTURI[Force Tool Update Response Item]
        QS[Query Stats]
    end
    
    subgraph "Agent Management"
        ALI[Agent List Item]
        AI[Agent Info]
        ARS[Agent Registration Secret]
    end
    
    FTI --> FTIR
    FTU --> FTURI
    FTIA --> QS
    
    FTIR --> ALI
    FTURI --> AI
    QS --> ARS
```

**Key Design Patterns**:
- **Command Pattern**: Force operations encapsulate tool management commands
- **Response Object Pattern**: Standardized response structures for all operations
- **Bulk Operations**: Support for operations across multiple agents/machines

### Modules 10-13: Advanced Features and Integrations

```mermaid
graph TD
    subgraph "Advanced Filtering"
        MQF[Machine Query Filter]
        TQF[Tool Query Filter]
        ATID[Agent ID Transformer]
    end
    
    subgraph "External Integrations"
        FMD[FleetMDM Integration]
        ITS[Integrated Tool Service]
        TUS[Tool URL Service]
    end
    
    subgraph "Reactive Repositories"
        RTR[Reactive Tenant Repository]
        ROAR[Reactive OAuth Client Repository]
        RAIT[Reactive API Key Repository]
    end
    
    MQF --> RTR
    TQF --> ROAR
    ATID --> RAIT
    
    ATID --> FMD
    FMD --> ITS
    ITS --> TUS
```

**Key Design Patterns**:
- **Transformer Pattern**: Agent ID transformers for different external systems
- **Repository Pattern**: Consistent data access across all entities
- **Integration Layer**: Clean abstractions for external service communication

## Data Models and Relationships

### Organization Domain Model

```mermaid
erDiagram
    Organization {
        UUID id PK
        string name
        string category
        int numberOfEmployees
        string websiteUrl
        string notes
        BigDecimal monthlyRevenue
        LocalDate contractStartDate
        LocalDate contractEndDate
        ContactInformation contactInfo FK
    }
    
    ContactInformation {
        UUID id PK
        string email
        string phone
        Address address FK
        ContactPerson contactPerson FK
    }
    
    Address {
        UUID id PK
        string street
        string city
        string state
        string zipCode
        string country
    }
    
    ContactPerson {
        UUID id PK
        string firstName
        string lastName
        string title
        string email
        string phone
    }
    
    Organization ||--|| ContactInformation : has
    ContactInformation ||--|| Address : located_at
    ContactInformation ||--|| ContactPerson : primary_contact
```

### Device and Event Model

```mermaid
erDiagram
    Device {
        UUID id PK
        string hostname
        string deviceType
        string status
        LocalDateTime lastSeen
        UUID organizationId FK
    }
    
    Event {
        UUID id PK
        string eventType
        string severity
        LocalDateTime timestamp
        UUID deviceId FK
        UUID organizationId FK
        LogDetails details FK
    }
    
    LogDetails {
        UUID id PK
        LocalDateTime timestamp
        string userId
        string action
        string details
        string ipAddress
        string userAgent
    }
    
    Device ||--o{ Event : generates
    Event ||--|| LogDetails : contains
    Organization ||--o{ Device : owns
    Organization ||--o{ Event : related_to
```

## Key Design Patterns

### 1. Builder Pattern Implementation

```java
// Consistent builder pattern across all DTOs
@Builder
public record CreateOrganizationRequest(
    @NotBlank String name,
    String category,
    @PositiveOrZero Integer numberOfEmployees,
    @Valid ContactInformationDto contactInformation
) {
    // Builder pattern enables fluent API
    public static CreateOrganizationRequestBuilder builder() {
        return new CreateOrganizationRequestBuilder();
    }
}

// Usage example
CreateOrganizationRequest request = CreateOrganizationRequest.builder()
    .name("Tech Corp")
    .category("Technology")
    .numberOfEmployees(100)
    .contactInformation(ContactInformationDto.builder()
        .email("info@techcorp.com")
        .build())
    .build();
```

### 2. Strategy Pattern for Client Registration

```java
public interface ClientRegistrationStrategy {
    ClientRegistration buildClientRegistration(String providerId);
    boolean supports(String providerId);
}

@Component
public class GoogleClientRegistrationStrategy implements ClientRegistrationStrategy {
    @Override
    public ClientRegistration buildClientRegistration(String providerId) {
        return ClientRegistration.withRegistrationId("google")
            .clientId(googleClientId)
            .clientSecret(googleClientSecret)
            .scope("openid", "profile", "email")
            .authorizationUri("https://accounts.google.com/o/oauth2/auth")
            .tokenUri("https://oauth2.googleapis.com/token")
            .build();
    }
    
    @Override
    public boolean supports(String providerId) {
        return "google".equals(providerId);
    }
}
```

### 3. Generic Response Pattern

```java
// Generic response wrapper for consistent API responses
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class GenericQueryResult<T> {
    private List<T> items;
    private CursorPageInfo pageInfo;
}

// Specialized counted version for analytics
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class CountedGenericQueryResult<T> extends GenericQueryResult<T> {
    private long totalCount;
}
```

### 4. Reactive Repository Pattern

```java
// Consistent reactive repository interface
public interface ReactiveOrganizationRepository 
    extends ReactiveMongoRepository<Organization, UUID>, 
            BaseTenantRepository<Organization> {
    
    Flux<Organization> findByNameContainingIgnoreCase(String name);
    Flux<Organization> findByCategory(String category);
    Mono<Long> countByOrganizationId(UUID organizationId);
}

// Implementation with custom queries
@Repository
public class ReactiveOrganizationRepositoryImpl 
    implements ReactiveOrganizationRepository {
    
    private final ReactiveMongoTemplate mongoTemplate;
    
    public Flux<Organization> findWithFilters(OrganizationFilterOptions filters) {
        Query query = new Query();
        
        if (filters.getNameContains() != null) {
            query.addCriteria(Criteria.where("name")
                .regex(filters.getNameContains(), "i"));
        }
        
        if (filters.getCategory() != null) {
            query.addCriteria(Criteria.where("category")
                .is(filters.getCategory()));
        }
        
        return mongoTemplate.find(query, Organization.class);
    }
}
```

## Module Dependencies and Integration Points

```mermaid
graph TD
    subgraph "External Dependencies"
        SPRING[Spring Boot 3.x]
        MONGO[Spring Data MongoDB]
        SECURITY[Spring Security]
        WEBFLUX[Spring WebFlux]
        KAFKA[Spring Kafka]
    end
    
    subgraph "Internal Modules"
        API_LIB[openframe-api-lib]
        CLIENT[openframe-client-core]
        AUTH[openframe-authorization-service-core]
        STREAM[openframe-stream-service-core]
        API_SVC[openframe-api-service-core]
    end
    
    subgraph "External SDKs"
        FLEET_SDK[FleetMDM SDK]
        TACTICAL_SDK[TacticalRMM SDK]
    end
    
    API_LIB --> SPRING
    API_LIB --> MONGO
    
    CLIENT --> API_LIB
    CLIENT --> FLEET_SDK
    CLIENT --> TACTICAL_SDK
    
    AUTH --> SECURITY
    AUTH --> API_LIB
    
    STREAM --> KAFKA
    STREAM --> API_LIB
    
    API_SVC --> WEBFLUX
    API_SVC --> API_LIB
    
    style API_LIB fill:#e1f5fe
    style SPRING fill:#c8e6c9
```

## Security and Authentication Architecture

### OIDC Integration Flow

```mermaid
sequenceDiagram
    participant Client as Client App
    participant Auth as Auth Service
    participant Provider as OIDC Provider
    participant API as OpenFrame API
    
    Client->>Auth: 1. Initiate Login
    Auth->>Provider: 2. Redirect to Provider
    Provider->>Client: 3. Authorization Code
    Client->>Auth: 4. Exchange Code
    Auth->>Provider: 5. Get Access Token
    Provider->>Auth: 6. Return JWT Token
    Auth->>Client: 7. Return Session Token
    
    Client->>API: 8. API Request + Token
    API->>Auth: 9. Validate Token
    Auth->>API: 10. Token Valid
    API->>Client: 11. Return Response
```

### Authorization Strategy Pattern

```java
@Component
public class BaseOIDCClientRegistrationStrategy {
    
    public ClientRegistration buildClientRegistration(String providerId, OIDCConfig config) {
        return ClientRegistration.withRegistrationId(providerId)
            .clientId(config.getClientId())
            .clientSecret(config.getClientSecret())
            .scope(config.getScopes())
            .authorizationUri(config.getAuthorizationUri())
            .tokenUri(config.getTokenUri())
            .userInfoUri(config.getUserInfoUri())
            .jwkSetUri(config.getJwkSetUri())
            .clientName(providerId)
            .build();
    }
}
```

## Performance and Scalability Considerations

### Reactive Programming Benefits

- **Non-blocking I/O**: WebFlux reactive repositories handle high concurrency
- **Backpressure Support**: Stream processing with controlled flow
- **Memory Efficiency**: Lazy evaluation and streaming responses

### Caching Strategy

```java
@Service
@CacheConfig(cacheNames = "organizations")
public class OrganizationService {
    
    @Cacheable(key = "#id")
    public Mono<OrganizationResponse> findById(UUID id) {
        return repository.findById(id)
            .map(this::toResponse);
    }
    
    @CacheEvict(key = "#result.id")
    public Mono<OrganizationResponse> updateOrganization(UpdateOrganizationRequest request) {
        return repository.save(toEntity(request))
            .map(this::toResponse);
    }
}
```

### Query Optimization

- **Index Strategy**: Compound indexes on frequently queried fields
- **Pagination**: Cursor-based pagination for large datasets  
- **Projection**: Select only required fields in queries
- **Bulk Operations**: Batch processing for tool installations

## Monitoring and Observability

### Logging Integration

```java
@Slf4j
@Component
public class AuditLoggingService {
    
    public void logOrganizationCreated(UUID organizationId, String userId) {
        LogEvent event = LogEvent.builder()
            .eventId(UUID.randomUUID())
            .severity("INFO")
            .category("ORGANIZATION_MANAGEMENT")
            .logDetails(LogDetails.builder()
                .timestamp(LocalDateTime.now())
                .userId(userId)
                .action("ORGANIZATION_CREATED")
                .organizationId(organizationId)
                .build())
            .build();
            
        log.info("Organization created: {}", event);
        eventRepository.save(event).subscribe();
    }
}
```

## Future Architecture Considerations

### Microservices Evolution

```mermaid
graph TD
    subgraph "Current Modular Monolith"
        API[API Service]
        AUTH[Auth Service]
        CLIENT[Client Service]
        STREAM[Stream Service]
    end
    
    subgraph "Future Microservices"
        ORG_SVC[Organization Service]
        DEVICE_SVC[Device Service]
        TOOL_SVC[Tool Service]
        EVENT_SVC[Event Service]
    end
    
    subgraph "Shared Infrastructure"
        GATEWAY[API Gateway]
        SERVICE_MESH[Service Mesh]
        CONFIG[Config Server]
    end
    
    API -.->|Extract| ORG_SVC
    CLIENT -.->|Extract| DEVICE_SVC
    STREAM -.->|Extract| EVENT_SVC
    
    GATEWAY --> ORG_SVC
    GATEWAY --> DEVICE_SVC
    GATEWAY --> TOOL_SVC
    GATEWAY --> EVENT_SVC
```

**Next Steps**: As the system grows, consider extracting domain-specific services while maintaining the current DTO contracts for backward compatibility.

This architecture provides a solid foundation for the OpenFrame ecosystem with clear separation of concerns, consistent patterns, and built-in scalability features.