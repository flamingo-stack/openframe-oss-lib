# Architecture Overview

This document provides a comprehensive technical overview of the OpenFrame OSS Library architecture, focusing on the design principles, component relationships, and data flow patterns that developers need to understand when working with or contributing to the library.

## High-Level Architecture

The OpenFrame OSS Library is designed with a modular, layered architecture that promotes reusability, type safety, and clear separation of concerns.

```mermaid
flowchart TB
    subgraph client[Client Layer]
        WebApp[Web Applications]
        MobileApp[Mobile Apps]
        Services[Backend Services]
        APIs[API Gateways]
    end
    
    subgraph platform[OpenFrame Platform]
        AuditService[Audit Service]
        DeviceService[Device Management Service]
        QueryService[Query Processing Service]
        FilterService[Filtering Service]
    end
    
    subgraph library[OpenFrame OSS Library]
        subgraph module1[module_1: Core DTOs]
            LogEvent[LogEvent]
            LogDetails[LogDetails]
            LogFilters[LogFilters]
            DeviceFilterOptions[DeviceFilterOptions]
            OrgFilterOption[OrganizationFilterOption]
        end
        
        subgraph module2[module_2: Query & Filters]
            GenericResult[GenericQueryResult<T>]
            CountedResult[CountedGenericQueryResult<T>]
            DeviceFilters[DeviceFilters]
            DeviceOption[DeviceFilterOption]
            LogFilterOpts[LogFilterOptions]
        end
        
        subgraph shared[Shared Components]
            CursorPageInfo[CursorPageInfo]
            BaseTypes[Base Types & Utilities]
        end
    end
    
    client -->|HTTP/REST API| platform
    platform -->|Uses DTOs| library
    module1 -->|Composed in| module2
    shared -->|Used by| module1
    shared -->|Used by| module2
    
    style library fill:#e8f5e8
    style module1 fill:#e3f2fd
    style module2 fill:#f3e5f5
    style shared fill:#fff3e0
```

## Core Design Principles

### 1. **Immutability and Thread Safety**

All DTOs are designed to be immutable after construction, ensuring thread safety and predictable behavior:

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogEvent {
    private final String toolEventId;
    private final String eventType;
    // ... other immutable fields
}
```

**Benefits:**
- Thread-safe by default
- Predictable state management
- Safe to share across service boundaries
- Easier to reason about in concurrent environments

### 2. **Type Safety with Generics**

Generic types ensure compile-time type safety while maintaining flexibility:

```java
public class GenericQueryResult<T> {
    private List<T> items;
    private CursorPageInfo pageInfo;
}

// Usage examples:
GenericQueryResult<LogEvent> auditResults;
GenericQueryResult<DeviceInfo> deviceResults;
CountedGenericQueryResult<User> userResults;
```

### 3. **Builder Pattern with Lombok**

Consistent object creation using the builder pattern reduces boilerplate and improves readability:

```java
LogEvent event = LogEvent.builder()
    .toolEventId("evt_123")
    .eventType("USER_LOGIN")
    .severity("INFO")
    .timestamp(Instant.now())
    .build();
```

### 4. **Composition Over Inheritance**

Components are designed to be composed rather than extended, promoting flexibility:

```mermaid
flowchart TD
    LogFilters[LogFilters] -->|contains| OrgFilterOptions[OrganizationFilterOption]
    DeviceFilters[DeviceFilters] -->|contains| DeviceFilterOption[DeviceFilterOption]
    GenericResult[GenericQueryResult] -->|contains| CursorPageInfo[CursorPageInfo]
    CountedResult[CountedGenericQueryResult] -->|extends| GenericResult
```

## Module Architecture

### Module 1: Core DTOs and Domain Objects

**Purpose**: Fundamental data structures for audit logging and device management.

```mermaid
classDiagram
    class LogEvent {
        +String toolEventId
        +String eventType
        +String toolType
        +String severity
        +String userId
        +String deviceId
        +String hostname
        +String organizationId
        +String organizationName
        +String summary
        +Instant timestamp
    }
    
    class LogDetails {
        +String toolEventId
        +String eventType
        +String toolType
        +String severity
        +String userId
        +String deviceId
        +String hostname
        +String organizationId
        +String organizationName
        +String summary
        +Instant timestamp
        +String message
        +String detail
    }
    
    class LogFilters {
        +List~String~ toolTypes
        +List~String~ eventTypes
        +List~String~ severities
        +List~OrganizationFilterOption~ organizations
    }
    
    class OrganizationFilterOption {
        +String organizationId
        +String organizationName
    }
    
    class DeviceFilterOptions {
        +List~String~ status
        +List~String~ type
        +List~String~ os
        +List~String~ organization
        +List~String~ tags
    }
    
    LogDetails --|> LogEvent : extends
    LogFilters --> OrganizationFilterOption : contains
```

**Key Characteristics:**
- **Domain-focused**: Each class represents a specific business concept
- **Rich metadata**: Comprehensive field coverage for audit and device contexts
- **Extensible**: LogDetails extends LogEvent with additional information
- **Filter-ready**: Built-in support for complex filtering scenarios

### Module 2: Query Results and Filter Aggregations

**Purpose**: Generic query processing, pagination, and filter management.

```mermaid
classDiagram
    class GenericQueryResult~T~ {
        +List~T~ items
        +CursorPageInfo pageInfo
    }
    
    class CountedGenericQueryResult~T~ {
        +List~T~ items
        +CursorPageInfo pageInfo
        +Integer filteredCount
    }
    
    class CursorPageInfo {
        +boolean hasNextPage
        +boolean hasPreviousPage
        +String startCursor
        +String endCursor
    }
    
    class DeviceFilters {
        +List~DeviceFilterOption~ status
        +List~DeviceFilterOption~ type
        +List~DeviceFilterOption~ os
        +List~DeviceFilterOption~ organization
        +List~DeviceFilterOption~ tags
        +Integer filteredDevicesCount
    }
    
    class DeviceFilterOption {
        +String value
        +String label
        +Integer count
    }
    
    class LogFilterOptions {
        +LocalDate startDate
        +LocalDate endDate
        +List~String~ toolTypes
        +List~String~ eventTypes
        +List~String~ severities
        +List~String~ organizations
        +String deviceId
    }
    
    CountedGenericQueryResult --|> GenericQueryResult : extends
    GenericQueryResult --> CursorPageInfo : contains
    DeviceFilters --> DeviceFilterOption : contains
```

**Key Characteristics:**
- **Generic flexibility**: Works with any data type through generics
- **Pagination support**: Cursor-based pagination for efficient large dataset handling
- **Count information**: Optional total count for UI requirements
- **Filter aggregation**: Structured filter options with counts and labels

## Data Flow Patterns

### 1. Audit Event Flow

```mermaid
sequenceDiagram
    participant Client
    participant Service
    participant Library
    participant Database
    
    Client->>Service: Create audit event
    Service->>Library: LogEvent.builder()
    Library->>Service: LogEvent instance
    Service->>Database: Store event
    
    Client->>Service: Query audit events
    Service->>Library: LogFilters.builder()
    Library->>Service: LogFilters instance
    Service->>Database: Query with filters
    Database->>Service: Raw results
    Service->>Library: GenericQueryResult.builder()
    Library->>Service: Paginated results
    Service->>Client: JSON response
```

### 2. Device Management Flow

```mermaid
sequenceDiagram
    participant Client
    participant Service
    participant Library
    participant Database
    
    Client->>Service: Get device filters
    Service->>Database: Query device metadata
    Database->>Service: Device counts by category
    Service->>Library: DeviceFilters.builder()
    Library->>Service: DeviceFilters with options
    Service->>Client: Filter options
    
    Client->>Service: Query devices with filters
    Service->>Library: Apply filter criteria
    Library->>Service: Filter validation
    Service->>Database: Filtered device query
    Database->>Service: Device results
    Service->>Library: CountedGenericQueryResult.builder()
    Library->>Service: Paginated device results
    Service->>Client: Device list with pagination
```

### 3. Generic Query Processing

```mermaid
flowchart TD
    Start([Query Request]) --> Parse[Parse Query Parameters]
    Parse --> Validate[Validate Filters]
    Validate --> Apply[Apply Business Logic]
    Apply --> Execute[Execute Database Query]
    Execute --> Paginate[Apply Pagination]
    Paginate --> Build[Build Generic Result]
    Build --> Serialize[Serialize Response]
    Serialize --> End([Response])
    
    subgraph library[Library Components Used]
        FilterDTOs[Filter DTOs]
        GenericResult[GenericQueryResult]
        PageInfo[CursorPageInfo]
    end
    
    Parse -.-> FilterDTOs
    Build -.-> GenericResult
    Paginate -.-> PageInfo
    
    style library fill:#e8f5e8
```

## Component Relationships

### Dependency Graph

```mermaid
flowchart TD
    subgraph external[External Dependencies]
        Lombok[Lombok Annotations]
        Jackson[Jackson JSON]
        JavaTime[Java Time API]
    end
    
    subgraph module1[module_1]
        LogEvent[LogEvent]
        LogDetails[LogDetails]
        LogFilters[LogFilters]
        OrgFilter[OrganizationFilterOption]
        DeviceFilterOptions[DeviceFilterOptions]
    end
    
    subgraph module2[module_2]
        GenericResult[GenericQueryResult]
        CountedResult[CountedGenericQueryResult]
        DeviceFilters[DeviceFilters]
        DeviceFilterOption[DeviceFilterOption]
        LogFilterOptions[LogFilterOptions]
    end
    
    subgraph shared[Shared]
        CursorPageInfo[CursorPageInfo]
    end
    
    external --> module1
    external --> module2
    external --> shared
    
    module1 --> module2
    shared --> module1
    shared --> module2
    
    LogDetails -.->|extends| LogEvent
    CountedResult -.->|extends| GenericResult
    LogFilters -.->|uses| OrgFilter
    DeviceFilters -.->|uses| DeviceFilterOption
    GenericResult -.->|uses| CursorPageInfo
```

### Inter-Module Communication

| Source Module | Target Module | Relationship Type | Example |
|---------------|---------------|-------------------|---------|
| module_1 | module_2 | Composition | `DeviceFilterOptions` used in `DeviceFilters` |
| module_1 | module_2 | Data flow | `LogEvent` instances in `GenericQueryResult<LogEvent>` |
| shared | module_1 | Utility | `CursorPageInfo` used for pagination |
| shared | module_2 | Utility | Generic types and common interfaces |

## Extension Points and Customization

### 1. Adding New Filter Types

To add new filter capabilities:

```java
// 1. Create new filter option DTO
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocationFilterOption {
    private String region;
    private String country;
    private String city;
    private Integer count;
}

// 2. Extend existing filter aggregator
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnhancedDeviceFilters {
    private List<DeviceFilterOption> status;
    private List<DeviceFilterOption> type;
    private List<LocationFilterOption> locations; // New filter type
    private Integer filteredDevicesCount;
}
```

### 2. Custom Query Result Types

For specialized query results:

```java
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsQueryResult<T> extends GenericQueryResult<T> {
    private Map<String, Object> aggregations;
    private List<String> warnings;
    private Long executionTimeMs;
}
```

### 3. Domain-Specific Extensions

For new business domains:

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityEvent {
    private String eventId;
    private String threatLevel;
    private String sourceIp;
    private String targetResource;
    private Instant detectedAt;
    // ... security-specific fields
}
```

## Performance Considerations

### Memory Efficiency

**Immutable Collections:**
```java
// Use immutable collections for better memory management
@Singular
private List<String> toolTypes; // Lombok @Singular creates efficient collections
```

**Lazy Loading Patterns:**
```java
// For expensive computations, use lazy evaluation
public class DeviceFilters {
    private List<DeviceFilterOption> status;
    
    @JsonIgnore
    private transient Integer cachedCount; // Cached computation
    
    public Integer getTotalCount() {
        if (cachedCount == null) {
            cachedCount = status.stream()
                .mapToInt(DeviceFilterOption::getCount)
                .sum();
        }
        return cachedCount;
    }
}
```

### Serialization Optimization

**JSON Serialization:**
```java
@JsonInclude(JsonInclude.Include.NON_NULL) // Exclude null values
@JsonPropertyOrder({"id", "type", "timestamp"}) // Consistent ordering
public class OptimizedLogEvent {
    // Fields ordered by frequency of access
}
```

**Custom Serializers:**
```java
@JsonSerialize(using = InstantSerializer.class)
@JsonDeserialize(using = InstantDeserializer.class)
private Instant timestamp;
```

## Testing Architecture

### Test Structure

```mermaid
flowchart TD
    subgraph tests[Test Architecture]
        UnitTests[Unit Tests]
        IntegrationTests[Integration Tests]
        SerializationTests[JSON Serialization Tests]
        BuilderTests[Builder Pattern Tests]
    end
    
    subgraph utilities[Test Utilities]
        TestDataFactory[TestDataFactory]
        MockBuilders[Mock Builders]
        AssertionHelpers[Custom Assertions]
    end
    
    tests --> utilities
    UnitTests --> TestDataFactory
    IntegrationTests --> MockBuilders
    SerializationTests --> AssertionHelpers
```

### Test Patterns

**Builder Testing:**
```java
@Test
void testLogEventBuilder() {
    LogEvent event = LogEvent.builder()
        .toolEventId("test_id")
        .eventType("TEST")
        .build();
        
    assertThat(event.getToolEventId()).isEqualTo("test_id");
    assertThat(event.getEventType()).isEqualTo("TEST");
}
```

**Serialization Testing:**
```java
@Test
void testJsonSerialization() throws Exception {
    LogEvent event = TestDataFactory.defaultLogEvent().build();
    
    String json = objectMapper.writeValueAsString(event);
    LogEvent deserialized = objectMapper.readValue(json, LogEvent.class);
    
    assertThat(deserialized).isEqualTo(event);
}
```

## Security Considerations

### Data Privacy

**PII Handling:**
```java
public class LogEvent {
    @JsonIgnore // Exclude from JSON serialization
    private String sensitiveUserData;
    
    // Use hashed or tokenized identifiers instead of raw PII
    private String hashedUserId; // Instead of raw user email
}
```

**Audit Trail Integrity:**
```java
public class SecureLogEvent extends LogEvent {
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private String eventHash; // Tamper detection
    
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private Instant createdAt; // Immutable timestamp
}
```

### Input Validation

**Builder Validation:**
```java
public class ValidatedLogEvent {
    public static class ValidatedLogEventBuilder {
        public ValidatedLogEvent build() {
            Objects.requireNonNull(toolEventId, "toolEventId is required");
            Objects.requireNonNull(eventType, "eventType is required");
            
            if (severity != null && !VALID_SEVERITIES.contains(severity)) {
                throw new IllegalArgumentException("Invalid severity: " + severity);
            }
            
            return new ValidatedLogEvent(this);
        }
    }
}
```

## Deployment and Integration Patterns

### Service Integration

**Spring Boot Integration:**
```java
@Configuration
public class OpenFrameLibraryConfig {
    
    @Bean
    public ObjectMapper openFrameObjectMapper() {
        return new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);
    }
}
```

**Microservices Communication:**
```java
@RestController
public class AuditController {
    
    @PostMapping("/audit/events")
    public ResponseEntity<GenericQueryResult<LogEvent>> createAuditEvents(
            @RequestBody List<LogEvent> events) {
        
        // Business logic using library DTOs
        GenericQueryResult<LogEvent> result = auditService.processEvents(events);
        return ResponseEntity.ok(result);
    }
}
```

---

## Summary

The OpenFrame OSS Library architecture emphasizes:

1. **Modularity**: Clear separation between core DTOs and query processing
2. **Type Safety**: Compile-time guarantees through generics
3. **Immutability**: Thread-safe, predictable objects
4. **Extensibility**: Easy to extend for new use cases
5. **Performance**: Efficient memory usage and serialization
6. **Testing**: Comprehensive test coverage and utilities

Understanding this architecture enables developers to effectively use the library, contribute new features, and integrate it into larger systems while maintaining consistency and performance.

**Next Steps**: Explore the [Testing Overview](../testing/overview.md) to understand how to test code that uses these architectural patterns.