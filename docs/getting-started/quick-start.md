# Quick Start Guide

Get OpenFrame OSS Lib up and running in 5 minutes with this streamlined guide.

[![OpenFrame Product Walkthrough (Beta Access)](https://img.youtube.com/vi/awc-yAnkhIo/maxresdefault.jpg)](https://www.youtube.com/watch?v=awc-yAnkhIo)

## TL;DR - 5-Minute Setup

```bash
# 1. Clone the repository
git clone https://github.com/openframe/openframe-oss-lib.git
cd openframe-oss-lib

# 2. Build the project
mvn clean compile

# 3. Run tests
mvn test

# 4. Install to local repository
mvn install
```

That's it! The library is now ready for use in your projects.

## Step-by-Step Walkthrough

### Step 1: Clone the Repository

```bash
# Clone from GitHub
git clone https://github.com/openframe/openframe-oss-lib.git

# Navigate to project directory
cd openframe-oss-lib

# Verify project structure
ls -la
```

Expected output:
```text
drwxr-xr-x  openframe-api-lib/
-rw-r--r--  pom.xml
-rw-r--r--  README.md
```

### Step 2: Verify Prerequisites

```bash
# Check Java version (8+ required)
java -version

# Check Maven version (3.6+ required)  
mvn -version

# Verify project structure
find . -name "*.java" | head -5
```

### Step 3: Build the Project

```bash
# Clean and compile
mvn clean compile

# Expected output indicates successful compilation
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

### Step 4: Run Tests

```bash
# Execute all tests
mvn test

# Or run tests with verbose output
mvn test -X
```

### Step 5: Install to Local Repository

```bash
# Install to local Maven repository (~/.m2/repository)
mvn install

# Verify installation
ls ~/.m2/repository/com/openframe/api/
```

## Project Structure Overview

After cloning, you'll see this structure:

```text
openframe-oss-lib/
├── pom.xml                                    # Maven configuration
├── openframe-api-lib/
│   └── src/main/java/com/openframe/api/dto/
│       ├── GenericQueryResult.java            # Module 1: Generic pagination
│       ├── CountedGenericQueryResult.java     # Module 1: Filtered pagination
│       ├── audit/
│       │   ├── LogEvent.java                  # Module 1: Audit summaries
│       │   ├── LogDetails.java               # Module 1: Detailed logs
│       │   ├── LogFilterCriteria.java        # Module 1: Audit filtering
│       │   ├── LogFilters.java               # Module 2: Audit filter options
│       │   └── OrganizationFilterOption.java # Module 2: Org filter options
│       └── device/
│           ├── DeviceFilterCriteria.java     # Module 2: Device filter input
│           ├── DeviceFilters.java            # Module 2: Device filter options
│           └── DeviceFilterOption.java       # Module 2: Device faceted filters
```

## Hello World Example

Create a simple example to test the DTOs:

### Create Test Class

Create `src/test/java/QuickStartTest.java`:

```java
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.audit.LogEvent;
import org.junit.Test;
import java.util.Arrays;
import java.util.List;

public class QuickStartTest {
    
    @Test
    public void testBasicQueryResult() {
        // Create sample data
        List<String> items = Arrays.asList("item1", "item2", "item3");
        
        // Build generic query result
        GenericQueryResult<String> result = GenericQueryResult.<String>builder()
            .items(items)
            .build();
            
        // Verify
        assert result.getItems().size() == 3;
        System.out.println("✅ Basic query result works!");
    }
    
    @Test 
    public void testCountedQueryResult() {
        // Create sample audit events
        List<LogEvent> events = Arrays.asList(
            LogEvent.builder().summary("User login").build(),
            LogEvent.builder().summary("Data export").build()
        );
        
        // Build counted result
        CountedGenericQueryResult<LogEvent> result = 
            CountedGenericQueryResult.<LogEvent>builder()
                .items(events)
                .filteredCount(25) // Total matching filter
                .build();
        
        // Verify
        assert result.getItems().size() == 2;
        assert result.getFilteredCount() == 25;
        System.out.println("✅ Counted query result works!");
    }
}
```

### Run the Test

```bash
# Run your test
mvn test -Dtest=QuickStartTest

# Expected output
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
✅ Basic query result works!
✅ Counted query result works!
```

## Using in Your Project

### Add Maven Dependency

After running `mvn install`, add to your project's `pom.xml`:

```xml
<dependency>
    <groupId>com.openframe.api</groupId>
    <artifactId>openframe-api-lib</artifactId>
    <version>1.0-SNAPSHOT</version>
</dependency>
```

### Basic Usage Example

```java
// In your service class
@Service
public class AuditService {
    
    public CountedGenericQueryResult<LogEvent> getAuditLogs(
        LogFilterCriteria criteria) {
        
        // Apply your business logic here
        List<LogEvent> events = repository.findFilteredLogs(criteria);
        int totalCount = repository.countFilteredLogs(criteria);
        
        // Return standardized response
        return CountedGenericQueryResult.<LogEvent>builder()
            .items(events)
            .filteredCount(totalCount)
            .pageInfo(buildPageInfo(criteria))
            .build();
    }
}
```

### Controller Example

```java
// In your REST controller
@RestController
@RequestMapping("/api/audit")
public class AuditController {
    
    @PostMapping("/logs")
    public CountedGenericQueryResult<LogEvent> getAuditLogs(
        @RequestBody LogFilterCriteria criteria) {
        
        return auditService.getAuditLogs(criteria);
    }
}
```

## Expected Results

After completing this quick start:

✅ **Project builds successfully** without compilation errors  
✅ **All tests pass** confirming DTOs work correctly  
✅ **Library installed locally** ready for use in other projects  
✅ **Basic examples work** demonstrating pagination and filtering  

## Common First-Time Issues

### Build Fails with Lombok Errors

**Problem**: Compilation errors about missing getters/setters
```bash
# Solution: Ensure your IDE has Lombok support
# IntelliJ: Install Lombok plugin + enable annotation processing  
# Eclipse: Run lombok.jar installer
```

### Tests Don't Run

**Problem**: `mvn test` shows no tests executed
```bash
# Solution: Ensure test classes follow naming convention
# Test files must end with Test.java, Tests.java, or TestCase.java
```

### Maven Dependencies Not Found

**Problem**: Cannot resolve OpenFrame dependencies
```bash
# Solution: Ensure you have access to required repositories
mvn dependency:resolve
```

## What You've Accomplished

In just 5 minutes, you've:

1. **Cloned** the OpenFrame OSS Lib repository
2. **Built** the entire project from source
3. **Tested** that all DTOs work correctly  
4. **Installed** the library to your local Maven repository
5. **Created** a working example using the core DTOs

## Next Steps

Now that you have OpenFrame OSS Lib working:

- [**First Steps**](first-steps.md) - Explore the core features and patterns
- **Architecture Deep Dive** - Review the [Module 1](../reference/architecture/module_1/module_1.md) and [Module 2](../reference/architecture/module_2/module_2.md) documentation
- **Join the Community** - Connect with other developers on [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)

## Need Help?

If you encounter any issues:

1. **Check Prerequisites** - Ensure Java 8+ and Maven 3.6+ are installed
2. **Review Error Messages** - Maven provides detailed compilation errors
3. **Ask for Help** - Join our [Slack community](https://join.slack.com/t/openmsp/shared_invoke/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) for support

---

*🎉 Congratulations! You now have a working OpenFrame OSS Lib installation. The library provides the foundation for building scalable, type-safe APIs across the entire OpenFrame platform.*