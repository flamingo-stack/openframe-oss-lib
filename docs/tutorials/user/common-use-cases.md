# Common Use Cases with OpenFrame API Library

This guide covers the most common scenarios you'll encounter when working with OpenFrame, with practical examples and step-by-step instructions.

## Top Use Cases Overview

1. [Managing Organizations](#1-managing-organizations)
2. [Working with Devices](#2-working-with-devices)
3. [Event Tracking and Monitoring](#3-event-tracking-and-monitoring)
4. [Audit Log Analysis](#4-audit-log-analysis)
5. [Implementing Filters and Search](#5-implementing-filters-and-search)
6. [Handling Paginated Data](#6-handling-paginated-data)
7. [Contact Information Management](#7-contact-information-management)

---

## 1. Managing Organizations

### How do I create a new organization with contact details?

**Scenario:** You need to onboard a new client organization with complete contact information.

```java
import com.openframe.api.dto.organization.*;
import java.math.BigDecimal;
import java.time.LocalDate;

// Complete organization setup
CreateOrganizationRequest newOrg = CreateOrganizationRequest.builder()
    .name("Acme Technologies Inc.")
    .category("Software Development")
    .numberOfEmployees(150)
    .websiteUrl("https://acme-tech.com")
    .notes("Enterprise client - priority support")
    .contactInformation(ContactInformationDto.builder()
        .email("partnerships@acme-tech.com")
        .phone("+1-555-0199")
        .address(AddressDto.builder()
            .street("123 Innovation Drive")
            .city("San Francisco")
            .state("CA")
            .zipCode("94105")
            .country("USA")
            .build())
        .contactPerson(ContactPersonDto.builder()
            .firstName("Jane")
            .lastName("Smith")
            .title("VP of Engineering")
            .email("jane.smith@acme-tech.com")
            .phone("+1-555-0198")
            .build())
        .build())
    .monthlyRevenue(new BigDecimal("500000.00"))
    .contractStartDate(LocalDate.now())
    .contractEndDate(LocalDate.now().plusYears(2))
    .build();
```

### Best Practice: Minimal Organization Creation

For quick setups, you only need the required fields:

```java
// Minimal organization - just the essentials
CreateOrganizationRequest quickOrg = CreateOrganizationRequest.builder()
    .name("Quick Setup Corp")
    .build();
```

---

## 2. Working with Devices

### How do I filter devices by organization and tags?

**Scenario:** You want to find all devices belonging to a specific organization with certain tags.

```java
import com.openframe.api.dto.device.*;

// Set up device filters
DeviceFilters deviceFilter = DeviceFilters.builder()
    .organizations(List.of("org-12345"))  // Filter by organization ID
    .tags(List.of("production", "web-server"))  // Filter by tags
    .build();

// Use the filter in your query
DeviceFilterOptions filterOptions = DeviceFilterOptions.builder()
    .filters(deviceFilter)
    .includeInactive(false)  // Only active devices
    .build();
```

### Device Management Tips

> **Tip:** Always include the `includeInactive` flag to control whether you want to see disabled devices in your results.

---

## 3. Event Tracking and Monitoring

### How do I track system events across different tools?

**Scenario:** You need to monitor authentication events across your organization.

```java
import com.openframe.api.dto.audit.LogEvent;
import java.time.Instant;

// Create an audit log event
LogEvent authEvent = LogEvent.builder()
    .toolEventId("auth-" + System.currentTimeMillis())
    .eventType("USER_LOGIN")
    .severity("INFO")
    .userId("user-67890")
    .organizationId("org-12345")
    .organizationName("Acme Technologies Inc.")
    .toolType("AUTHENTICATION")
    .summary("User successfully authenticated via SSO")
    .timestamp(Instant.now())
    .hostname("auth-server-01")
    .ingestDay(LocalDate.now().toString())
    .build();
```

### Event Filtering for Analysis

```java
import com.openframe.api.dto.event.*;

// Filter events by type and date range
EventFilters eventFilters = EventFilters.builder()
    .eventTypes(List.of("USER_LOGIN", "USER_LOGOUT", "FAILED_LOGIN"))
    .dateRange(DateRange.builder()
        .startDate(LocalDate.now().minusDays(7))
        .endDate(LocalDate.now())
        .build())
    .severityLevels(List.of("ERROR", "WARN"))
    .build();
```

---

## 4. Audit Log Analysis

### How do I query audit logs for security analysis?

**Scenario:** Security team needs to investigate failed login attempts.

```java
import com.openframe.api.dto.audit.*;

// Create comprehensive audit log filters
LogFilters securityFilters = LogFilters.builder()
    .eventTypes(List.of("FAILED_LOGIN", "SUSPICIOUS_ACTIVITY"))
    .severityLevel("ERROR")
    .dateRange(DateRange.builder()
        .startDate(LocalDate.now().minusDays(30))
        .endDate(LocalDate.now())
        .build())
    .organizationIds(List.of("org-12345", "org-67890"))
    .build();

LogFilterOptions filterOptions = LogFilterOptions.builder()
    .filters(securityFilters)
    .includeDetails(true)  // Get full event details
    .sortBy("timestamp")
    .sortOrder("DESC")
    .build();
```

### Audit Log Best Practices

| Practice | Description | Example |
|----------|-------------|---------|
| **Include timestamps** | Always specify date ranges for performance | Last 30 days, specific incident window |
| **Filter by severity** | Focus on ERROR and WARN events for security | `severityLevel("ERROR")` |
| **Organization scoping** | Limit to relevant organizations | `organizationIds(List.of("org-123"))` |
| **Event type specificity** | Use specific event types instead of broad queries | "FAILED_LOGIN" vs all events |

---

## 5. Implementing Filters and Search

### How do I implement organization search with filters?

**Scenario:** Users need to search organizations by name and filter by employee count.

```java
import com.openframe.api.dto.organization.*;

// Organization search and filtering
OrganizationFilterOptions searchOptions = OrganizationFilterOptions.builder()
    .nameFilter("Tech")  // Search for organizations with "Tech" in name
    .categoryFilter("Software Development")
    .minEmployees(50)    // Organizations with 50+ employees
    .maxEmployees(500)   // But less than 500 employees
    .hasActiveContract(true)
    .build();
```

### Advanced Filtering Techniques

<details>
<summary>Complex Filter Combinations</summary>

```java
// Combining multiple filter criteria
OrganizationFilters complexFilter = OrganizationFilters.builder()
    .categories(List.of("Technology", "Healthcare", "Finance"))
    .employeeRanges(List.of(
        EmployeeRange.builder().min(10).max(50).build(),
        EmployeeRange.builder().min(100).max(500).build()
    ))
    .revenueThreshold(new BigDecimal("100000"))
    .contractStatuses(List.of("ACTIVE", "PENDING_RENEWAL"))
    .build();
```
</details>

---

## 6. Handling Paginated Data

### How do I efficiently process large datasets?

**Scenario:** You need to process thousands of audit logs without overwhelming memory.

```java
import com.openframe.api.dto.GenericQueryResult;

public class DataProcessor {
    
    public void processAllAuditLogs() {
        String cursor = null;
        boolean hasMore = true;
        
        while (hasMore) {
            // Get next batch of results
            GenericQueryResult<LogEvent> result = getAuditLogs(cursor, 50);
            
            // Process this batch
            processBatch(result.getItems());
            
            // Check if there are more results
            hasMore = result.getPageInfo().isHasNextPage();
            cursor = result.getPageInfo().getEndCursor();
            
            System.out.println("Processed " + result.getItems().size() + 
                             " events. More data: " + hasMore);
        }
    }
    
    private void processBatch(List<LogEvent> events) {
        events.forEach(event -> {
            System.out.println("Processing event: " + event.getEventType());
            // Your processing logic here
        });
    }
}
```

### Pagination Best Practices

> **Performance Tip:** Use page sizes between 20-100 items for optimal performance. Larger page sizes may cause timeouts.

---

## 7. Contact Information Management

### How do I update organization contact details?

**Scenario:** An organization has moved offices and changed their contact information.

```java
// Complete contact information update
ContactInformationDto updatedContact = ContactInformationDto.builder()
    .email("newhq@acme-tech.com")
    .phone("+1-555-0299")
    .address(AddressDto.builder()
        .street("456 New Business Blvd")
        .city("Austin")
        .state("TX")
        .zipCode("78701")
        .country("USA")
        .build())
    .contactPerson(ContactPersonDto.builder()
        .firstName("John")
        .lastName("Doe")
        .title("Director of Operations")
        .email("john.doe@acme-tech.com")
        .phone("+1-555-0298")
        .build())
    .build();
```

---

## Troubleshooting Common Problems

### Validation Errors

**Problem:** Getting validation errors when creating organizations.

**Solution:** Check these common validation rules:

```java
// ❌ Common mistakes
CreateOrganizationRequest badRequest = CreateOrganizationRequest.builder()
    .name("")  // Empty name - fails @NotBlank validation
    .numberOfEmployees(-5)  // Negative number - fails @PositiveOrZero
    .monthlyRevenue(new BigDecimal("-1000"))  // Negative revenue - fails validation
    .build();

// ✅ Correct approach
CreateOrganizationRequest goodRequest = CreateOrganizationRequest.builder()
    .name("Valid Company Name")  // Non-empty string
    .numberOfEmployees(25)       // Zero or positive
    .monthlyRevenue(new BigDecimal("75000.00"))  // Zero or positive
    .build();
```

### Performance Issues

**Problem:** Queries are slow or timing out.

**Solutions:**

1. **Use appropriate page sizes**: 20-50 items per page
2. **Add specific filters**: Don't query all data at once
3. **Use date ranges**: Limit time windows for log queries
4. **Cache frequently accessed data**: Store common organization lists

### Memory Usage

**Problem:** Application running out of memory with large datasets.

**Solution:** Always use pagination instead of loading all data:

```java
// ❌ Don't do this - loads everything into memory
List<LogEvent> allEvents = getAllEvents();  // Dangerous with large datasets

// ✅ Do this - process in batches
processInBatches(50);  // Process 50 items at a time
```

---

## Quick Reference

| Task | Key DTO | Main Method |
|------|---------|-------------|
| Create Organization | `CreateOrganizationRequest` | `.builder().name().build()` |
| Filter Devices | `DeviceFilterOptions` | `.filters().includeInactive()` |
| Track Events | `LogEvent` | `.eventType().severity().timestamp()` |
| Search Audit Logs | `LogFilterOptions` | `.filters().includeDetails()` |
| Handle Results | `GenericQueryResult<T>` | `.getItems()`, `.getPageInfo()` |

## Next Steps

- **For Developers:** Check out the [Developer Getting Started Guide](../dev/getting-started-dev.md) for advanced implementation details
- **For Architecture:** Review the [Architecture Overview](../dev/architecture-overview-dev.md) to understand system design
- **For Support:** Visit our [documentation portal](https://docs.openframe.io) for API references