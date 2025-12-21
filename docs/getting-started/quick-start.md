# Quick Start Guide

Get up and running with the OpenFrame OSS Library in just 5 minutes! This guide will have you creating and working with audit logs and device filters in no time.

## 🚀 5-Minute Setup

### Step 1: Add the Dependency

Add the OpenFrame OSS Library to your `pom.xml`:

```xml
<dependencies>
    <dependency>
        <groupId>com.openframe</groupId>
        <artifactId>openframe-oss-lib</artifactId>
        <version>1.0.0</version>
    </dependency>
    
    <!-- Lombok for annotation processing -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>1.18.24</version>
        <scope>provided</scope>
    </dependency>
</dependencies>
```

### Step 2: Create Your First Java Class

Create a new file `QuickStartExample.java`:

```java
package com.example;

import com.openframe.api.dto.audit.LogEvent;
import com.openframe.api.dto.audit.LogFilters;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.CountedGenericQueryResult;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

public class QuickStartExample {
    public static void main(String[] args) {
        System.out.println("🚀 OpenFrame OSS Library Quick Start");
        
        // Example 1: Create an audit log event
        createLogEvent();
        
        // Example 2: Set up device filters
        setupDeviceFilters();
        
        // Example 3: Work with query results
        handleQueryResults();
        
        System.out.println("✅ Quick start complete!");
    }
    
    // Example 1: Creating audit log events
    private static void createLogEvent() {
        LogEvent loginEvent = LogEvent.builder()
            .toolEventId("evt-" + System.currentTimeMillis())
            .eventType("USER_LOGIN")
            .severity("INFO")
            .userId("user-12345")
            .deviceId("device-67890")
            .hostname("app-server-01")
            .organizationId("org-abc123")
            .organizationName("Acme Corporation")
            .toolType("AUTHENTICATION")
            .summary("User successfully logged in to the system")
            .timestamp(Instant.now())
            .ingestDay("2024-01-15")
            .build();
            
        System.out.println("📝 Created log event: " + loginEvent.getEventType());
        System.out.println("   Event ID: " + loginEvent.getToolEventId());
        System.out.println("   Organization: " + loginEvent.getOrganizationName());
    }
    
    // Example 2: Setting up device filters
    private static void setupDeviceFilters() {
        DeviceFilters filters = DeviceFilters.builder()
            .statuses(Arrays.asList("ACTIVE", "PENDING"))
            .deviceTypes(Arrays.asList("LAPTOP", "MOBILE", "TABLET"))
            .osTypes(Arrays.asList("WINDOWS", "MACOS", "LINUX"))
            .organizationIds(Arrays.asList("org-abc123", "org-def456"))
            .filteredCount(150)
            .build();
            
        System.out.println("🔍 Device filters configured:");
        System.out.println("   Statuses: " + filters.getStatuses());
        System.out.println("   Device types: " + filters.getDeviceTypes());
        System.out.println("   Filtered count: " + filters.getFilteredCount());
    }
    
    // Example 3: Working with query results
    private static void handleQueryResults() {
        // Create sample data
        List<LogEvent> sampleEvents = Arrays.asList(
            LogEvent.builder()
                .toolEventId("evt-001")
                .eventType("LOGIN")
                .severity("INFO")
                .timestamp(Instant.now())
                .build(),
            LogEvent.builder()
                .toolEventId("evt-002")
                .eventType("LOGOUT")
                .severity("INFO")
                .timestamp(Instant.now())
                .build()
        );
        
        // Create a counted query result
        CountedGenericQueryResult<LogEvent> result = CountedGenericQueryResult.<LogEvent>builder()
            .items(sampleEvents)
            .filteredCount(2)
            .build();
            
        System.out.println("📊 Query results:");
        System.out.println("   Total items: " + result.getItems().size());
        System.out.println("   Filtered count: " + result.getFilteredCount());
        System.out.println("   First event type: " + result.getItems().get(0).getEventType());
    }
}
```

### Step 3: Run the Example

```bash
# Compile and run
mvn compile exec:java -Dexec.mainClass="com.example.QuickStartExample"
```

## 📊 Expected Output

When you run the example, you should see:

```
🚀 OpenFrame OSS Library Quick Start
📝 Created log event: USER_LOGIN
   Event ID: evt-1642608123456
   Organization: Acme Corporation
🔍 Device filters configured:
   Statuses: [ACTIVE, PENDING]
   Device types: [LAPTOP, MOBILE, TABLET]
   Filtered count: 150
📊 Query results:
   Total items: 2
   Filtered count: 2
   First event type: LOGIN
✅ Quick start complete!
```

## 🎯 What You Just Learned

In this quick start, you:

1. **Created audit log events** using the builder pattern
2. **Set up device filters** for querying device data
3. **Worked with query results** including pagination support
4. **Used Lombok annotations** to reduce boilerplate code

## 🧪 Try These Variations

### Experiment 1: Different Event Types

```java
// Create a security alert
LogEvent securityAlert = LogEvent.builder()
    .toolEventId("sec-" + System.currentTimeMillis())
    .eventType("SECURITY_VIOLATION")
    .severity("HIGH")
    .userId("user-99999")
    .summary("Unauthorized access attempt detected")
    .timestamp(Instant.now())
    .build();
```

### Experiment 2: Advanced Filtering

```java
// Create log filters for audit queries
LogFilters logFilters = LogFilters.builder()
    .toolTypes(Arrays.asList("AUTHENTICATION", "AUTHORIZATION"))
    .eventTypes(Arrays.asList("LOGIN", "LOGOUT", "PERMISSION_CHANGE"))
    .severities(Arrays.asList("HIGH", "CRITICAL"))
    .build();
```

### Experiment 3: Pagination

```java
// Create paginated results
GenericQueryResult<String> pagedResult = GenericQueryResult.<String>builder()
    .items(Arrays.asList("item1", "item2", "item3"))
    // Note: pageInfo would contain cursor information in real usage
    .build();
```

## 🔍 Core Concepts Recap

| Concept | Description | Example |
|---------|-------------|---------|
| **LogEvent** | Represents audit log entries | User login, security alerts |
| **DeviceFilters** | Filters for device queries | Status, type, organization |
| **QueryResult** | Generic container for results | Paginated data responses |
| **Builder Pattern** | Fluent object creation | `.builder()...build()` |

## 🚨 Common Quick Start Issues

### Issue: Compilation Errors
```bash
# Solution: Ensure Lombok is properly configured
mvn clean compile -X
```

### Issue: Missing Dependencies
```bash
# Solution: Force dependency update
mvn clean install -U
```

### Issue: Lombok Not Working
- Ensure Lombok plugin is installed in your IDE
- Enable annotation processing in IDE settings
- Restart your IDE after installation

## 🚀 What's Next?

Now that you've got the basics working:

1. **[First Steps](first-steps.md)** - Explore more features and patterns
2. **[Architecture Overview](../development/architecture/overview.md)** - Understand the system design
3. **[Development Setup](../development/setup/local-development.md)** - Set up for contribution

## 💡 Pro Tips

- **Use builder pattern**: It's the recommended way to create DTOs
- **Leverage Lombok**: Reduces boilerplate and improves maintainability  
- **Check null values**: Always validate data before using
- **Use appropriate severity levels**: INFO, WARN, HIGH, CRITICAL
- **Include meaningful event IDs**: Use prefixes to categorize events

---

> **🎉 Congratulations!** You've successfully set up and run your first OpenFrame OSS Library code. The library is designed to be intuitive and powerful - you're now ready to explore its full capabilities!