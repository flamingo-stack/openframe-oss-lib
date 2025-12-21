# Quick Start Guide

Get up and running with the OpenFrame OSS Library in under 5 minutes! This guide will walk you through adding the library to your project and creating your first audit log event.

## Step 1: Add Dependency

Add the OpenFrame OSS Library to your project dependencies:

### Maven

```xml
<dependency>
    <groupId>com.openframe</groupId>
    <artifactId>openframe-api-lib</artifactId>
    <version>1.0.0</version>
</dependency>

<!-- Required: Lombok for annotations -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <version>1.18.24</version>
    <scope>provided</scope>
</dependency>
```

### Gradle

```gradle
dependencies {
    implementation 'com.openframe:openframe-api-lib:1.0.0'
    compileOnly 'org.projectlombok:lombok:1.18.24'
    annotationProcessor 'org.projectlombok:lombok:1.18.24'
}
```

## Step 2: Create Your First Log Event

Create a simple Java class to demonstrate basic usage:

```java
package com.example.demo;

import com.openframe.api.dto.audit.LogEvent;
import com.openframe.api.dto.audit.LogDetails;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.shared.CursorPageInfo;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

public class QuickStartExample {
    
    public static void main(String[] args) {
        // Create a log event
        LogEvent event = createSampleLogEvent();
        System.out.println("Created log event: " + event.getEventType());
        
        // Create log details
        LogDetails details = createLogDetails();
        System.out.println("Created log details: " + details.getMessage());
        
        // Create a query result with events
        GenericQueryResult<LogEvent> result = createQueryResult(event);
        System.out.println("Query returned " + result.getItems().size() + " events");
        
        // Display the results
        displayResults(result);
    }
    
    private static LogEvent createSampleLogEvent() {
        return LogEvent.builder()
            .toolEventId("evt_12345")
            .eventType("USER_LOGIN")
            .ingestDay("2024-01-15")
            .toolType("AUTHENTICATION")
            .severity("INFO")
            .userId("user_789")
            .deviceId("device_456")
            .hostname("app-server-01")
            .organizationId("org_123")
            .organizationName("Acme Corp")
            .summary("User successful login")
            .timestamp(Instant.now())
            .build();
    }
    
    private static LogDetails createLogDetails() {
        return LogDetails.builder()
            .toolEventId("evt_12345")
            .eventType("USER_LOGIN")
            .ingestDay("2024-01-15")
            .toolType("AUTHENTICATION")
            .severity("INFO")
            .userId("user_789")
            .deviceId("device_456")
            .hostname("app-server-01")
            .organizationId("org_123")
            .organizationName("Acme Corp")
            .summary("User successful login")
            .timestamp(Instant.now())
            .message("User john.doe@acme.com successfully logged in from device_456")
            .detail("Authentication method: SSO, Session ID: sess_abc123, IP: 192.168.1.100")
            .build();
    }
    
    private static GenericQueryResult<LogEvent> createQueryResult(LogEvent event) {
        List<LogEvent> events = Arrays.asList(event);
        
        CursorPageInfo pageInfo = CursorPageInfo.builder()
            .hasNextPage(false)
            .hasPreviousPage(false)
            .startCursor("cursor_start")
            .endCursor("cursor_end")
            .build();
            
        return GenericQueryResult.<LogEvent>builder()
            .items(events)
            .pageInfo(pageInfo)
            .build();
    }
    
    private static void displayResults(GenericQueryResult<LogEvent> result) {
        System.out.println("\\n=== Query Results ===");
        System.out.println("Events found: " + result.getItems().size());
        System.out.println("Has next page: " + result.getPageInfo().isHasNextPage());
        
        for (LogEvent event : result.getItems()) {
            System.out.println("\\nEvent Details:");
            System.out.println("  ID: " + event.getToolEventId());
            System.out.println("  Type: " + event.getEventType());
            System.out.println("  Severity: " + event.getSeverity());
            System.out.println("  Organization: " + event.getOrganizationName());
            System.out.println("  Summary: " + event.getSummary());
            System.out.println("  Timestamp: " + event.getTimestamp());
        }
    }
}
```

> **Note**: You'll need to implement the `CursorPageInfo` class or use the appropriate package import based on your project structure.

## Step 3: Compile and Run

Compile and run your example:

```bash
# Compile the project
mvn compile

# Run the example
mvn exec:java -Dexec.mainClass="com.example.demo.QuickStartExample"
```

## Expected Output

You should see output similar to:

```text
Created log event: USER_LOGIN
Created log details: User john.doe@acme.com successfully logged in from device_456

=== Query Results ===
Events found: 1
Has next page: false

Event Details:
  ID: evt_12345
  Type: USER_LOGIN
  Severity: INFO
  Organization: Acme Corp
  Summary: User successful login
  Timestamp: 2024-01-15T10:30:45.123Z
```

## Step 4: Explore Device Filtering

Add device filtering capabilities to your example:

```java
import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.dto.device.DeviceFilters;

public class DeviceFilterExample {
    
    public static void createDeviceFilters() {
        // Create filter options
        DeviceFilterOption statusOption = DeviceFilterOption.builder()
            .value("ACTIVE")
            .label("Active Devices")
            .count(150)
            .build();
            
        DeviceFilterOption typeOption = DeviceFilterOption.builder()
            .value("LAPTOP")
            .label("Laptops")
            .count(75)
            .build();
        
        // Create device filters
        DeviceFilters filters = DeviceFilters.builder()
            .status(Arrays.asList(statusOption))
            .type(Arrays.asList(typeOption))
            .filteredDevicesCount(225)
            .build();
            
        System.out.println("Device filters created with " + 
            filters.getFilteredDevicesCount() + " total devices");
    }
}
```

## What You've Accomplished

✅ **Added OpenFrame OSS Library** to your project  
✅ **Created audit log events** with rich metadata  
✅ **Implemented query results** with pagination  
✅ **Explored device filtering** capabilities  
✅ **Ran your first example** successfully  

## Key Concepts Demonstrated

| Concept | What You Learned |
|---------|------------------|
| **LogEvent** | Core audit event structure with metadata |
| **LogDetails** | Extended event information with messages |
| **GenericQueryResult** | Paginated query response handling |
| **Builder Pattern** | Lombok-powered object creation |
| **Type Safety** | Generic types for different data models |

## Next Steps

Now that you have the basics working:

1. **[Explore First Steps](first-steps.md)** - Learn about key features and common patterns
2. **[Architecture Overview](../development/architecture/overview.md)** - Understand the library structure  
3. **[Development Setup](../development/setup/local-development.md)** - Set up for contributing

## Common Issues & Solutions

### Issue: Lombok not working

```bash
# Ensure Lombok plugin is installed in your IDE
# Enable annotation processing in IDE settings
# Verify Lombok dependency in pom.xml/build.gradle
```

### Issue: Import errors

```bash
# Verify all dependencies are properly added
mvn dependency:tree

# Force refresh dependencies
mvn clean compile -U
```

### Issue: Build failures

```bash
# Check Java version compatibility
java -version
javac -version

# Ensure Java 8+ is being used
```

> **Need Help?** Check the [development troubleshooting guide](../development/setup/environment.md#troubleshooting) for more solutions.

---

**🎉 Congratulations!** You've successfully set up and used the OpenFrame OSS Library. Ready to dive deeper? Continue with [First Steps](first-steps.md) to explore more features.