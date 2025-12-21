# Common Use Cases for OpenFrame OSS Library

This guide covers the most common scenarios you'll encounter when using the OpenFrame OSS Library for audit logging and device management.

## Overview of Use Cases

The OpenFrame OSS Library is primarily used for:
- **Audit Log Management**: Track and filter system events
- **Device Filtering**: Organize and query device information
- **Data Transfer**: Structure data for API communications
- **Query Management**: Handle paginated results efficiently

## Use Case 1: Basic Audit Log Creation

**Scenario**: You need to log user activities in your application.

### Step-by-Step Guide

**Step 1**: Import the required classes
```java
import com.openframe.api.dto.audit.LogEvent;
import java.time.Instant;
```

**Step 2**: Create log events for different activities
```java
// User login event
LogEvent loginEvent = LogEvent.builder()
    .toolEventId("login_" + System.currentTimeMillis())
    .eventType("LOGIN")
    .toolType("WEB_PORTAL")
    .severity("INFO")
    .userId("john.doe@company.com")
    .deviceId("laptop-001")
    .hostname("webapp.company.com")
    .organizationId("org_123")
    .organizationName("ACME Corp")
    .summary("User successfully logged in")
    .timestamp(Instant.now())
    .build();

// Security alert event
LogEvent securityEvent = LogEvent.builder()
    .toolEventId("security_" + System.currentTimeMillis())
    .eventType("SECURITY_ALERT")
    .toolType("SECURITY_SYSTEM")
    .severity("HIGH")
    .userId("john.doe@company.com")
    .deviceId("laptop-001")
    .hostname("security.company.com")
    .organizationId("org_123")
    .organizationName("ACME Corp")
    .summary("Multiple failed login attempts detected")
    .timestamp(Instant.now())
    .build();
```

**Best Practices**:
- Always include a meaningful `summary` field
- Use consistent `eventType` values across your application
- Set appropriate `severity` levels: INFO, LOW, MEDIUM, HIGH, CRITICAL

## Use Case 2: Advanced Log Filtering

**Scenario**: You need to filter audit logs by organization, severity, and time period.

### Step-by-Step Implementation

**Step 1**: Set up organization filters
```java
import com.openframe.api.dto.audit.LogFilters;
import com.openframe.api.dto.audit.OrganizationFilterOption;
import java.util.Arrays;

// Create organization filter options
OrganizationFilterOption org1 = OrganizationFilterOption.builder()
    .id("org_123")
    .name("ACME Corp")
    .build();

OrganizationFilterOption org2 = OrganizationFilterOption.builder()
    .id("org_456")
    .name("TechStart Inc")
    .build();
```

**Step 2**: Build comprehensive log filters
```java
LogFilters filters = LogFilters.builder()
    .toolTypes(Arrays.asList("WEB_PORTAL", "MOBILE_APP"))
    .eventTypes(Arrays.asList("LOGIN", "LOGOUT", "SECURITY_ALERT"))
    .severities(Arrays.asList("HIGH", "CRITICAL"))
    .organizations(Arrays.asList(org1, org2))
    .build();
```

**Step 3**: Apply filters to your query logic
```java
// Pseudo-code for how you might use these filters
public List<LogEvent> getFilteredLogs(LogFilters filters) {
    return logRepository.findByFilters(
        filters.getToolTypes(),
        filters.getEventTypes(),
        filters.getSeverities(),
        filters.getOrganizations()
    );
}
```

## Use Case 3: Device Management and Filtering

**Scenario**: You need to manage devices across different organizations and filter by status and type.

### Implementation Steps

**Step 1**: Create device filter options
```java
import com.openframe.api.dto.device.*;
import java.util.Arrays;

// Device status options
DeviceFilterOption activeDevices = DeviceFilterOption.builder()
    .value("ACTIVE")
    .label("Active Devices")
    .build();

DeviceFilterOption inactiveDevices = DeviceFilterOption.builder()
    .value("INACTIVE") 
    .label("Inactive Devices")
    .build();

// Device type options
DeviceFilterOption laptops = DeviceFilterOption.builder()
    .value("LAPTOP")
    .label("Laptop Computers")
    .build();

DeviceFilterOption desktops = DeviceFilterOption.builder()
    .value("DESKTOP")
    .label("Desktop Computers")
    .build();
```

**Step 2**: Set up comprehensive device filters
```java
DeviceFilterOptions deviceFilters = DeviceFilterOptions.builder()
    .statuses(Arrays.asList("ACTIVE", "MAINTENANCE"))
    .types(Arrays.asList("LAPTOP", "DESKTOP"))
    .osTypes(Arrays.asList("WINDOWS", "MACOS", "LINUX"))
    .organizationIds(Arrays.asList("org_123", "org_456"))
    .tagNames(Arrays.asList("development", "production"))
    .build();
```

**Step 3**: Use device filters in queries
```java
// Example usage in a service method
public List<Device> getDevicesByFilter(DeviceFilterOptions options) {
    return deviceRepository.findByStatusInAndTypeInAndOsTypeIn(
        options.getStatuses(),
        options.getTypes(),
        options.getOsTypes()
    );
}
```

## Use Case 4: Paginated Query Results

**Scenario**: You need to handle large datasets with pagination.

### Working with Generic Query Results

**Step 1**: Set up pagination info
```java
import com.openframe.api.dto.shared.CursorPageInfo;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.CountedGenericQueryResult;

// Create pagination information
CursorPageInfo pageInfo = CursorPageInfo.builder()
    .hasNextPage(true)
    .hasPreviousPage(false)
    .startCursor("cursor_start_123")
    .endCursor("cursor_end_456")
    .build();
```

**Step 2**: Create standard query results
```java
GenericQueryResult<LogEvent> logResults = GenericQueryResult.<LogEvent>builder()
    .items(Arrays.asList(loginEvent, securityEvent))
    .pageInfo(pageInfo)
    .build();

System.out.println("Retrieved " + logResults.getItems().size() + " log events");
```

**Step 3**: Use counted results when you need totals
```java
CountedGenericQueryResult<LogEvent> countedResults = 
    CountedGenericQueryResult.<LogEvent>builder()
        .items(Arrays.asList(loginEvent, securityEvent))
        .pageInfo(pageInfo)
        .filteredCount(150) // Total matching items
        .build();

System.out.println("Showing " + countedResults.getItems().size() + 
                   " of " + countedResults.getFilteredCount() + " total events");
```

## Use Case 5: Complex Multi-Level Filtering

**Scenario**: You need to create a dashboard that combines log and device filtering.

### Implementation Approach

**Step 1**: Create a combined filter service
```java
public class FilterService {
    
    public LogFilters createSecurityLogFilters() {
        return LogFilters.builder()
            .toolTypes(Arrays.asList("SECURITY_SYSTEM", "ACCESS_CONTROL"))
            .eventTypes(Arrays.asList("SECURITY_ALERT", "ACCESS_DENIED", "BREACH_ATTEMPT"))
            .severities(Arrays.asList("HIGH", "CRITICAL"))
            .build();
    }
    
    public DeviceFilterOptions createCompromisedDeviceFilters() {
        return DeviceFilterOptions.builder()
            .statuses(Arrays.asList("QUARANTINED", "SUSPECTED"))
            .types(Arrays.asList("LAPTOP", "MOBILE", "IOT"))
            .tagNames(Arrays.asList("security-alert", "needs-attention"))
            .build();
    }
}
```

**Step 2**: Use combined filters for comprehensive reporting
```java
public SecurityReport generateSecurityReport() {
    FilterService filterService = new FilterService();
    
    // Get security-related logs
    LogFilters logFilters = filterService.createSecurityLogFilters();
    List<LogEvent> securityLogs = getFilteredLogs(logFilters);
    
    // Get potentially compromised devices
    DeviceFilterOptions deviceFilters = filterService.createCompromisedDeviceFilters();
    List<Device> suspiciousDevices = getDevicesByFilter(deviceFilters);
    
    return SecurityReport.builder()
        .securityEvents(securityLogs)
        .flaggedDevices(suspiciousDevices)
        .generatedAt(Instant.now())
        .build();
}
```

## Tips and Best Practices

### Performance Optimization
- **Use specific filters**: Don't query all data when you need specific subsets
- **Implement pagination**: Always use `GenericQueryResult` for large datasets
- **Cache filter options**: Reuse `DeviceFilterOption` objects when possible

### Data Consistency
- **Standardize event types**: Create enums or constants for event types
- **Consistent severity levels**: Use a predefined set of severity levels
- **Validate timestamps**: Always use `Instant` for timestamp fields

### Error Handling
```java
public LogEvent createSafeLogEvent(String eventType, String summary) {
    try {
        return LogEvent.builder()
            .toolEventId(UUID.randomUUID().toString())
            .eventType(eventType != null ? eventType : "UNKNOWN")
            .summary(summary != null ? summary : "No summary provided")
            .timestamp(Instant.now())
            .build();
    } catch (Exception e) {
        // Fallback to minimal log event
        return LogEvent.builder()
            .toolEventId("error_" + System.currentTimeMillis())
            .eventType("ERROR")
            .summary("Failed to create log event: " + e.getMessage())
            .timestamp(Instant.now())
            .build();
    }
}
```

## Common Patterns Summary

| Use Case | Key Classes | Primary Benefits |
|----------|-------------|-----------------|
| **Basic Logging** | `LogEvent` | Simple event tracking |
| **Advanced Filtering** | `LogFilters`, `OrganizationFilterOption` | Complex query capabilities |
| **Device Management** | `DeviceFilterOptions`, `DeviceFilters` | Organized device queries |
| **Pagination** | `GenericQueryResult`, `CountedGenericQueryResult` | Efficient large dataset handling |
| **Combined Operations** | All classes together | Comprehensive data management |

## Troubleshooting Common Issues

<details>
<summary>Click to expand troubleshooting guide</summary>

### Issue: Empty Filter Results
**Problem**: Your filters return no results even though data exists.
**Solution**: 
- Check that filter values match exactly (case-sensitive)
- Verify organization IDs are correct
- Ensure timestamp ranges are properly set

### Issue: Performance Problems
**Problem**: Queries are running slowly.
**Solution**:
- Implement pagination using `GenericQueryResult`
- Use more specific filters to reduce result sets
- Consider database indexing on frequently filtered fields

### Issue: Memory Issues with Large Results
**Problem**: Out of memory errors with large datasets.
**Solution**:
- Always use pagination
- Process results in smaller batches
- Use `CountedGenericQueryResult` for count information without loading all data

</details>

## Next Steps

After mastering these common use cases, consider:

1. **Integration Patterns**: Learn how to integrate with REST APIs
2. **Advanced Querying**: Explore complex filter combinations
3. **Performance Tuning**: Optimize for your specific use case
4. **Custom Extensions**: Build custom DTOs based on these patterns

For more advanced topics, check out our [Developer Architecture Guide](../dev/architecture-overview-dev.md).