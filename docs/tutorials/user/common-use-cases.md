# OpenFrame API Library - Common Use Cases

This guide covers the most common scenarios and use cases when working with the OpenFrame API Library. Each use case includes practical examples, best practices, and troubleshooting tips.

## Table of Contents

1. [Managing Organizations](#managing-organizations)
2. [Device Filtering and Management](#device-filtering-and-management)
3. [Audit Logging and Event Tracking](#audit-logging-and-event-tracking)
4. [Implementing Pagination](#implementing-pagination)
5. [Building Search and Filter APIs](#building-search-and-filter-apis)
6. [Data Validation and Error Handling](#data-validation-and-error-handling)
7. [Multi-Tenant Application Support](#multi-tenant-application-support)

---

## Use Case 1: Managing Organizations

### Scenario: Creating and Managing Company Profiles

**When to use**: Building organization management features, onboarding new clients, or maintaining company directories.

#### Step-by-Step Implementation

**1. Create a New Organization**

```java
import com.openframe.api.dto.organization.*;
import java.time.LocalDate;
import java.math.BigDecimal;

public OrganizationResponse createNewOrganization(String companyName, String website) {
    // Build contact information
    ContactInformationDto contactInfo = ContactInformationDto.builder()
        .email("contact@" + website.replace("https://", ""))
        .phone("+1-555-0123")
        .build();
    
    // Create organization
    return OrganizationResponse.builder()
        .id(generateUniqueId())
        .name(companyName)
        .organizationId(generateOrganizationCode(companyName))
        .category("Business")
        .websiteUrl(website)
        .contactInformation(contactInfo)
        .contractStartDate(LocalDate.now())
        .contractEndDate(LocalDate.now().plusYears(1))
        .createdAt(Instant.now())
        .isDefault(false)
        .deleted(false)
        .build();
}
```

**2. Update Organization Information**

```java
public OrganizationResponse updateOrganization(String orgId, 
                                               Integer employeeCount, 
                                               BigDecimal revenue) {
    // Fetch existing organization (your implementation)
    OrganizationResponse existing = findOrganizationById(orgId);
    
    // Update with new information
    return existing.toBuilder()
        .numberOfEmployees(employeeCount)
        .monthlyRevenue(revenue)
        .updatedAt(Instant.now())
        .build();
}
```

**3. Handle Organization Deletion (Soft Delete)**

```java
public OrganizationResponse softDeleteOrganization(String orgId) {
    OrganizationResponse existing = findOrganizationById(orgId);
    
    return existing.toBuilder()
        .deleted(true)
        .deletedAt(Instant.now())
        .updatedAt(Instant.now())
        .build();
}
```

#### Best Practices for Organization Management

- Always use the builder pattern for creating DTOs
- Implement soft deletes by setting `deleted = true` instead of removing records
- Validate organization IDs are unique before creation
- Store audit information (`createdAt`, `updatedAt`) for tracking changes

---

## Use Case 2: Device Filtering and Management

### Scenario: Building a Device Dashboard with Advanced Filtering

**When to use**: Creating device management interfaces, monitoring dashboards, or device inventory systems.

#### Step-by-Step Implementation

**1. Create Flexible Device Filters**

```java
import com.openframe.api.dto.device.*;
import java.util.List;

// Filter active mobile devices for specific organizations
public DeviceFilterOptions createMobileDeviceFilter(List<String> orgIds) {
    return DeviceFilterOptions.builder()
        .organizationIds(orgIds)
        .deviceTypes(List.of(DeviceType.MOBILE, DeviceType.TABLET))
        .statuses(List.of(DeviceStatus.ACTIVE, DeviceStatus.IDLE))
        .osTypes(List.of("Android", "iOS"))
        .tagNames(List.of("mobile", "production"))
        .build();
}

// Filter devices needing maintenance
public DeviceFilterOptions createMaintenanceFilter() {
    return DeviceFilterOptions.builder()
        .statuses(List.of(DeviceStatus.MAINTENANCE, DeviceStatus.ERROR))
        .tagNames(List.of("needs-update", "critical"))
        .build();
}

// Filter by device tags for environment separation
public DeviceFilterOptions createEnvironmentFilter(String environment) {
    return DeviceFilterOptions.builder()
        .tagNames(List.of(environment)) // "production", "staging", "development"
        .statuses(List.of(DeviceStatus.ACTIVE))
        .build();
}
```

**2. Combine Multiple Filters**

```java
public DeviceFilterOptions createAdvancedFilter(String orgId, 
                                                String environment, 
                                                List<String> osTypes) {
    return DeviceFilterOptions.builder()
        .organizationIds(List.of(orgId))
        .tagNames(List.of(environment, "monitored"))
        .osTypes(osTypes)
        .statuses(List.of(DeviceStatus.ACTIVE, DeviceStatus.IDLE))
        .build();
}
```

**3. Use Filters in Your Service Layer**

```java
public class DeviceService {
    
    public List<Device> getActiveDevicesForOrganization(String orgId) {
        DeviceFilterOptions filter = DeviceFilterOptions.builder()
            .organizationIds(List.of(orgId))
            .statuses(List.of(DeviceStatus.ACTIVE))
            .build();
        
        return deviceRepository.findDevices(filter);
    }
    
    public List<Device> getDevicesNeedingAttention() {
        DeviceFilterOptions filter = DeviceFilterOptions.builder()
            .statuses(List.of(DeviceStatus.ERROR, DeviceStatus.MAINTENANCE))
            .build();
        
        return deviceRepository.findDevices(filter);
    }
}
```

#### Tips for Device Management

- Use specific tag names to categorize devices (e.g., "production", "testing", "critical")
- Combine multiple filter criteria for precise device selection
- Consider caching frequently used filter combinations
- Implement validation for filter parameters to prevent invalid queries

---

## Use Case 3: Audit Logging and Event Tracking

### Scenario: Implementing Comprehensive System Auditing

**When to use**: Compliance requirements, security monitoring, user activity tracking, or debugging system issues.

#### Step-by-Step Implementation

**1. Track User Actions**

```java
import com.openframe.api.dto.audit.*;
import java.time.Instant;
import java.time.LocalDate;

public LogEvent createUserActionLog(String userId, String action, String details) {
    return LogEvent.builder()
        .toolEventId("user-" + System.currentTimeMillis())
        .eventType("USER_ACTION")
        .toolType("WEB_APPLICATION")
        .severity("INFO")
        .userId(userId)
        .summary("User performed: " + action)
        .details(details)
        .timestamp(Instant.now())
        .ingestDay(LocalDate.now().toString())
        .build();
}

// Usage examples
LogEvent loginEvent = createUserActionLog("user123", "LOGIN", 
    "User logged in from IP: 192.168.1.100");
    
LogEvent dataExportEvent = createUserActionLog("user456", "DATA_EXPORT", 
    "Exported 500 customer records to CSV");
```

**2. Track System Events**

```java
public LogEvent createSystemEvent(String eventType, String severity, String message) {
    return LogEvent.builder()
        .toolEventId("sys-" + UUID.randomUUID().toString())
        .eventType(eventType)
        .toolType("SYSTEM")
        .severity(severity)
        .summary(message)
        .timestamp(Instant.now())
        .ingestDay(LocalDate.now().toString())
        .build();
}

// System startup event
LogEvent startupEvent = createSystemEvent("SYSTEM_STARTUP", "INFO", 
    "Application started successfully");

// Error event
LogEvent errorEvent = createSystemEvent("DATABASE_ERROR", "ERROR", 
    "Failed to connect to database after 3 retries");
```

**3. Track Device-Related Events**

```java
public LogEvent createDeviceEvent(String deviceId, String hostname, 
                                  String orgId, String eventType) {
    return LogEvent.builder()
        .toolEventId("device-" + deviceId + "-" + System.currentTimeMillis())
        .eventType(eventType)
        .toolType("DEVICE_MANAGEMENT")
        .severity("INFO")
        .deviceId(deviceId)
        .hostname(hostname)
        .organizationId(orgId)
        .summary("Device event: " + eventType)
        .timestamp(Instant.now())
        .ingestDay(LocalDate.now().toString())
        .build();
}
```

**4. Create Log Filters for Querying**

```java
import com.openframe.api.dto.audit.*;

// Filter critical events
public LogFilterOptions createCriticalEventsFilter() {
    return LogFilterOptions.builder()
        .severities(List.of("ERROR", "CRITICAL"))
        .eventTypes(List.of("SYSTEM_ERROR", "SECURITY_BREACH", "DATA_LOSS"))
        .build();
}

// Filter events for specific organization
public LogFilterOptions createOrganizationAuditFilter(String orgId) {
    LogFilters filters = LogFilters.builder()
        .organizationFilterOptions(OrganizationFilterOption.builder()
            .organizationIds(List.of(orgId))
            .build())
        .build();
    
    return LogFilterOptions.builder()
        .filters(filters)
        .build();
}
```

#### Audit Logging Best Practices

- Always include timestamps and unique event IDs
- Use consistent severity levels: INFO, WARN, ERROR, CRITICAL
- Include contextual information (user ID, organization ID, device ID)
- Implement log retention policies and archiving
- Consider log aggregation and search capabilities

---

## Use Case 4: Implementing Pagination

### Scenario: Handling Large Data Sets with Cursor-Based Pagination

**When to use**: API endpoints returning large lists, search results, or any data that needs to be paginated.

#### Step-by-Step Implementation

**1. Create Paginated Responses**

```java
import com.openframe.api.dto.*;
import com.openframe.api.dto.shared.CursorPageInfo;

public GenericQueryResult<OrganizationResponse> getPaginatedOrganizations(
        String cursor, int limit) {
    
    // Fetch organizations from your data source
    List<OrganizationResponse> organizations = fetchOrganizations(cursor, limit + 1);
    
    // Check if there are more results
    boolean hasNextPage = organizations.size() > limit;
    if (hasNextPage) {
        organizations = organizations.subList(0, limit); // Remove extra item
    }
    
    // Create page info
    CursorPageInfo pageInfo = CursorPageInfo.builder()
        .hasNextPage(hasNextPage)
        .hasPreviousPage(cursor != null && !cursor.isEmpty())
        .startCursor(organizations.isEmpty() ? null : 
                    generateCursor(organizations.get(0)))
        .endCursor(organizations.isEmpty() ? null : 
                  generateCursor(organizations.get(organizations.size() - 1)))
        .build();
    
    // Return paginated result
    return GenericQueryResult.<OrganizationResponse>builder()
        .items(organizations)
        .pageInfo(pageInfo)
        .build();
}
```

**2. Handle Different Data Types**

```java
// For any type of data
public <T> GenericQueryResult<T> createPaginatedResult(
        List<T> items, 
        boolean hasNext, 
        boolean hasPrevious,
        String startCursor,
        String endCursor) {
    
    CursorPageInfo pageInfo = CursorPageInfo.builder()
        .hasNextPage(hasNext)
        .hasPreviousPage(hasPrevious)
        .startCursor(startCursor)
        .endCursor(endCursor)
        .build();
    
    return GenericQueryResult.<T>builder()
        .items(items)
        .pageInfo(pageInfo)
        .build();
}
```

**3. REST API Controller Example**

```java
@RestController
public class OrganizationController {
    
    @GetMapping("/organizations")
    public ResponseEntity<GenericQueryResult<OrganizationResponse>> getOrganizations(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        
        GenericQueryResult<OrganizationResponse> result = 
            organizationService.getPaginatedOrganizations(cursor, limit);
        
        return ResponseEntity.ok(result);
    }
}
```

---

## Use Case 5: Building Search and Filter APIs

### Scenario: Creating Advanced Search Functionality

**When to use**: Search interfaces, advanced filtering, or complex query requirements.

#### Step-by-Step Implementation

**1. Combine Multiple Filter Types**

```java
public class SearchService {
    
    public GenericQueryResult<OrganizationResponse> searchOrganizations(
            String searchTerm,
            String category,
            List<String> organizationIds,
            String cursor,
            int limit) {
        
        // Build organization filters
        OrganizationFilterOptions orgFilters = OrganizationFilterOptions.builder()
            .organizationIds(organizationIds)
            .categories(category != null ? List.of(category) : null)
            .searchTerm(searchTerm)
            .build();
        
        // Execute search
        List<OrganizationResponse> results = 
            organizationRepository.search(orgFilters, cursor, limit);
        
        return createPaginatedResult(results, cursor, limit);
    }
}
```

**2. Device Search with Multiple Criteria**

```java
public GenericQueryResult<Device> searchDevices(
        String hostname,
        List<String> osTypes,
        List<String> tagNames,
        List<String> organizationIds) {
    
    DeviceFilterOptions filters = DeviceFilterOptions.builder()
        .hostname(hostname)
        .osTypes(osTypes)
        .tagNames(tagNames)
        .organizationIds(organizationIds)
        .statuses(List.of(DeviceStatus.ACTIVE)) // Only active devices
        .build();
    
    List<Device> devices = deviceRepository.findDevices(filters);
    
    return GenericQueryResult.<Device>builder()
        .items(devices)
        .pageInfo(createSimplePageInfo(devices.size()))
        .build();
}
```

---

## Use Case 6: Data Validation and Error Handling

### Scenario: Ensuring Data Integrity and Proper Error Handling

**When to use**: API validation, data integrity checks, or user input validation.

#### Step-by-Step Implementation

**1. Validate Organization Data**

```java
import javax.validation.constraints.*;

public class OrganizationValidator {
    
    public void validateOrganizationRequest(CreateOrganizationRequest request) {
        List<String> errors = new ArrayList<>();
        
        if (request.getName() == null || request.getName().trim().isEmpty()) {
            errors.add("Organization name is required");
        }
        
        if (request.getOrganizationId() == null || !isValidOrgId(request.getOrganizationId())) {
            errors.add("Valid organization ID is required");
        }
        
        if (request.getWebsiteUrl() != null && !isValidUrl(request.getWebsiteUrl())) {
            errors.add("Invalid website URL format");
        }
        
        if (!errors.isEmpty()) {
            throw new ValidationException("Validation failed: " + String.join(", ", errors));
        }
    }
    
    private boolean isValidOrgId(String orgId) {
        return orgId.matches("[A-Z0-9]{3,10}");
    }
    
    private boolean isValidUrl(String url) {
        try {
            new URL(url);
            return true;
        } catch (MalformedURLException e) {
            return false;
        }
    }
}
```

**2. Handle Common Errors**

```java
@ControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidation(ValidationException e) {
        ErrorResponse error = ErrorResponse.builder()
            .message("Validation Error")
            .details(e.getMessage())
            .timestamp(Instant.now())
            .build();
        
        return ResponseEntity.badRequest().body(error);
    }
}
```

---

## Use Case 7: Multi-Tenant Application Support

### Scenario: Building Applications for Multiple Organizations

**When to use**: SaaS applications, multi-tenant systems, or organization-isolated features.

#### Step-by-Step Implementation

**1. Organization Context Service**

```java
@Service
public class TenantContextService {
    
    public List<OrganizationResponse> getAccessibleOrganizations(String userId) {
        // Get organizations user has access to
        List<String> orgIds = userService.getUserOrganizations(userId);
        
        return orgIds.stream()
            .map(this::getOrganization)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    }
    
    public DeviceFilterOptions createTenantFilter(String userId, 
                                                  DeviceFilterOptions baseFilter) {
        List<String> allowedOrgs = userService.getUserOrganizations(userId);
        
        return baseFilter.toBuilder()
            .organizationIds(allowedOrgs)
            .build();
    }
}
```

**2. Tenant-Aware API Endpoints**

```java
@RestController
@RequestMapping("/api/v1")
public class TenantAwareController {
    
    @GetMapping("/devices")
    public GenericQueryResult<Device> getDevices(
            @RequestHeader("X-User-ID") String userId,
            @RequestParam(required = false) List<String> tags) {
        
        // Create base filter
        DeviceFilterOptions filter = DeviceFilterOptions.builder()
            .tagNames(tags)
            .statuses(List.of(DeviceStatus.ACTIVE))
            .build();
        
        // Apply tenant restrictions
        DeviceFilterOptions tenantFilter = 
            tenantContextService.createTenantFilter(userId, filter);
        
        List<Device> devices = deviceService.findDevices(tenantFilter);
        
        return createPaginatedResult(devices);
    }
}
```

## Common Troubleshooting

| Problem | Symptoms | Solution |
|---------|----------|----------|
| **Empty Results** | Queries return no data | Check filter criteria; ensure organization IDs are valid |
| **Validation Errors** | DTOs fail to build | Use builder pattern; check required fields |
| **Pagination Issues** | Incorrect page navigation | Verify cursor generation and hasNext/hasPrevious logic |
| **Performance Problems** | Slow query responses | Add database indexes; optimize filter combinations |
| **Memory Issues** | OutOfMemoryError with large datasets | Implement proper pagination; use streaming for large results |

## Tips and Tricks

### 🔍 **Search Optimization**
- Use specific filters to reduce result sets
- Implement caching for frequently used filter combinations
- Consider full-text search for text fields

### 📊 **Data Organization**
- Use consistent tag naming conventions
- Implement hierarchical organization structures
- Group related filters for better user experience

### 🚀 **Performance Tips**
- Batch process multiple operations
- Use appropriate page sizes (10-50 items typically)
- Cache frequently accessed organization data

### 🔒 **Security Best Practices**
- Always validate organization access permissions
- Implement proper tenant isolation
- Log security-relevant events

---

**Next Steps**: Explore the developer tutorials for deeper technical integration or check out specific API documentation for advanced features.

> **💡 Pro Tip**: Start with simple use cases and gradually add complexity. The OpenFrame DTOs are designed to be composable and extensible.

> **⚠️ Important**: Always validate user permissions when filtering by organization IDs in multi-tenant environments.