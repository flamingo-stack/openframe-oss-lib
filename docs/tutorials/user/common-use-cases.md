# Common Use Cases for OpenFrame OSS Library

This guide covers the most common scenarios you'll encounter when using OpenFrame OSS Library for managing your organization's devices, agents, and tools.

## Use Case 1: Managing Organizations

### Setting Up Multiple Organizations

**When to use**: You need to manage multiple companies or departments within your system.

```java
// Create a main organization
CreateOrganizationRequest mainOrg = CreateOrganizationRequest.builder()
    .name("Tech Solutions Inc.")
    .category("Technology")
    .numberOfEmployees(250)
    .websiteUrl("https://techsolutions.com")
    .contactInformation(ContactInformationDto.builder()
        .email("admin@techsolutions.com")
        .phone("+1-555-0100")
        .address(AddressDto.builder()
            .street("123 Tech Drive")
            .city("San Francisco")
            .state("CA")
            .zipCode("94105")
            .country("USA")
            .build())
        .build())
    .monthlyRevenue(new BigDecimal("150000.00"))
    .contractStartDate(LocalDate.now())
    .contractEndDate(LocalDate.now().plusYears(2))
    .build();

// Create a subsidiary
CreateOrganizationRequest subsidiary = CreateOrganizationRequest.builder()
    .name("Tech Solutions Europe")
    .category("Technology")
    .numberOfEmployees(75)
    .contactInformation(ContactInformationDto.builder()
        .email("europe@techsolutions.com")
        .phone("+44-20-1234-5678")
        .build())
    .monthlyRevenue(new BigDecimal("75000.00"))
    .contractStartDate(LocalDate.now())
    .contractEndDate(LocalDate.now().plusYears(2))
    .build();
```

**Best Practice**: Always include contact information and set realistic contract dates for better tracking.

## Use Case 2: Device and Agent Management

### Filtering Devices by Organization

**When to use**: You need to view devices belonging to specific organizations or with certain characteristics.

```java
// Filter devices by organization and status
DeviceFilterOptions deviceFilters = DeviceFilterOptions.builder()
    .organizationId("tech-solutions-uuid")
    .status("ACTIVE")
    .deviceType("WORKSTATION")
    .lastSeenAfter(LocalDateTime.now().minusDays(7))  // Active in last 7 days
    .build();

// Apply additional tag filters
TagFilterOption tagFilter = TagFilterOption.builder()
    .tagName("production")
    .tagValue("true")
    .build();

DeviceFilters combinedFilters = DeviceFilters.builder()
    .filterOptions(deviceFilters)
    .tagFilters(Arrays.asList(tagFilter))
    .build();
```

### Managing Agent Registrations

**When to use**: You're onboarding new devices and need to register agents.

```java
// Process agent registration
AgentRegistrationProcessor processor = new DefaultAgentRegistrationProcessor();

// Create agent info
AgentInfo agentInfo = AgentInfo.builder()
    .agentId("agent-12345")
    .hostname("workstation-001")
    .organizationId("tech-solutions-uuid")
    .site("San Francisco HQ")
    .client("Windows 11 Pro")
    .lastSeen(LocalDateTime.now())
    .build();

// Register the agent
processor.processRegistration(agentInfo);
```

**💡 Tip**: Use descriptive hostnames and consistent naming conventions for easier management.

## Use Case 3: Event Monitoring and Logging

### Setting Up Event Filtering

**When to use**: You need to monitor specific types of events or troubleshoot issues.

```java
// Create event filters for security monitoring
EventFilterOptions securityFilters = EventFilterOptions.builder()
    .eventType("SECURITY_ALERT")
    .severity("HIGH")
    .startDate(LocalDateTime.now().minusHours(24))
    .endDate(LocalDateTime.now())
    .organizationId("tech-solutions-uuid")
    .build();

// Filter by device characteristics
EventFilters eventFilters = EventFilters.builder()
    .filterOptions(securityFilters)
    .deviceFilters(DeviceFilters.builder()
        .filterOptions(DeviceFilterOptions.builder()
            .deviceType("SERVER")
            .status("ACTIVE")
            .build())
        .build())
    .build();
```

### Logging Important Events

**When to use**: You need to track user actions, system changes, or security events.

```java
// Create detailed log entry
LogDetails logDetails = LogDetails.builder()
    .timestamp(LocalDateTime.now())
    .userId("admin-user-123")
    .action("ORGANIZATION_CREATED")
    .organizationId("tech-solutions-uuid")
    .details("New organization 'Tech Solutions Inc.' created with 250 employees")
    .ipAddress("192.168.1.100")
    .userAgent("OpenFrame-Admin-Panel/1.0")
    .build();

// Create log event
LogEvent logEvent = LogEvent.builder()
    .eventId(UUID.randomUUID().toString())
    .logDetails(logDetails)
    .severity("INFO")
    .category("ORGANIZATION_MANAGEMENT")
    .build();
```

**Best Practice**: Include relevant context like user ID, IP address, and detailed descriptions for audit trails.

## Use Case 4: Querying and Pagination

### Implementing Efficient Data Retrieval

**When to use**: You need to display large datasets with pagination and filtering.

```java
// Query organizations with pagination
public GenericQueryResult<OrganizationResponse> getOrganizations(
        OrganizationFilterOptions filters, 
        String cursor, 
        int limit) {
    
    // Apply filters and pagination
    List<OrganizationResponse> organizations = queryService.findOrganizations(
        filters, cursor, limit);
    
    // Create page info
    CursorPageInfo pageInfo = CursorPageInfo.builder()
        .hasNextPage(organizations.size() == limit)
        .hasPreviousPage(cursor != null)
        .startCursor(organizations.isEmpty() ? null : organizations.get(0).getId())
        .endCursor(organizations.isEmpty() ? null : 
                  organizations.get(organizations.size() - 1).getId())
        .build();
    
    return GenericQueryResult.<OrganizationResponse>builder()
        .items(organizations)
        .pageInfo(pageInfo)
        .build();
}
```

### Using Counted Queries for Analytics

**When to use**: You need to show totals and statistics alongside paginated results.

```java
// Get counted results for dashboard
CountedGenericQueryResult<DeviceInfo> getDeviceStatistics(DeviceFilterOptions filters) {
    List<DeviceInfo> devices = deviceService.findDevices(filters);
    long totalCount = deviceService.countDevices(filters);
    
    return CountedGenericQueryResult.<DeviceInfo>builder()
        .items(devices)
        .totalCount(totalCount)
        .pageInfo(CursorPageInfo.builder()
            .hasNextPage(devices.size() < totalCount)
            .build())
        .build();
}
```

## Use Case 5: Tool Management and Updates

### Force Tool Installation

**When to use**: You need to deploy tools across multiple machines in your organization.

```java
// Install tool on specific machines
ForceToolInstallationRequest installRequest = ForceToolInstallationRequest.builder()
    .toolAgentId("security-scanner-v2.1")
    .machineIds(Arrays.asList(
        "machine-001", 
        "machine-002", 
        "machine-003"
    ))
    .organizationId("tech-solutions-uuid")
    .installationOptions(Map.of(
        "silent", "true",
        "autoStart", "true",
        "configPath", "/etc/security-scanner/"
    ))
    .build();

// Process installation
toolManagementService.installTool(installRequest);
```

### Tool Updates Across All Devices

**When to use**: You need to update a tool across all devices in an organization.

```java
// Update tool on all applicable devices
ForceToolInstallationAllRequest updateAllRequest = ForceToolInstallationAllRequest.builder()
    .toolAgentId("antivirus-engine-v5.2")
    .organizationId("tech-solutions-uuid")
    .updateOptions(Map.of(
        "preserveConfig", "true",
        "restartRequired", "false"
    ))
    .build();

// Execute update
ForceToolAgentInstallationResponse response = toolManagementService.updateToolAll(updateAllRequest);

// Check results
for (ForceToolAgentInstallationResponseItem item : response.getItems()) {
    if (item.isSuccess()) {
        System.out.println("✅ Updated on " + item.getHostname());
    } else {
        System.out.println("❌ Failed on " + item.getHostname() + ": " + item.getError());
    }
}
```

## Best Practices Summary

### Data Validation
- Always validate required fields before creating organizations
- Use positive values for employee counts and revenue
- Include proper contact information for better communication

### Filtering and Queries
- Combine multiple filter options for precise results
- Use date ranges to limit query scope and improve performance
- Implement pagination for large datasets

### Event Logging
- Log all significant actions with detailed context
- Include user information and timestamps for audit trails
- Use appropriate severity levels (INFO, WARN, ERROR)

### Tool Management
- Test tool installations on a small subset before mass deployment
- Monitor installation responses and handle failures gracefully
- Keep tool configurations consistent across environments

## Troubleshooting Common Scenarios

| Scenario | Symptoms | Quick Fix |
|----------|----------|-----------|
| **No devices returned** | Empty results despite having devices | Check filter criteria, ensure organization ID is correct |
| **Tool installation fails** | Installation response shows errors | Verify machine IDs exist and are accessible |
| **Pagination not working** | Same results on every page | Implement proper cursor handling and sorting |
| **Events not logging** | Missing audit trail entries | Check LogEvent creation and ensure required fields are set |
| **Performance issues** | Slow queries with large datasets | Add appropriate filters and limit result sizes |

## Advanced Tips and Tricks

<details>
<summary>💡 Performance Optimization</summary>

- Use indexed fields in your filters (organizationId, status, timestamps)
- Limit query results with reasonable page sizes (20-50 items)
- Cache frequently accessed organization data
- Use bulk operations for multiple tool installations

</details>

<details>
<summary>🔍 Debugging Common Issues</summary>

- Enable DEBUG logging for com.openframe packages
- Check database connectivity before complex queries
- Validate DTOs before sending requests
- Monitor memory usage during bulk operations

</details>

<details>
<summary>📊 Building Dashboards</summary>

- Use CountedGenericQueryResult for showing totals
- Implement real-time updates with event filtering
- Cache dashboard metrics to improve response times
- Provide drill-down capabilities with detailed filters

</details>

**Ready to implement these patterns?** Start with the organization management use case and gradually add device monitoring and tool management features as your needs grow.