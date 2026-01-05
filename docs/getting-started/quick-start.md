# Quick Start Guide

Get the OpenFrame OSS Library up and running in just 5 minutes! This guide will have you building your first integration with OpenFrame's core DTOs and services.

## 🚀 TL;DR - 5 Minute Setup

```bash
# 1. Clone the repository  
git clone https://github.com/openframe/openframe-oss-lib.git
cd openframe-oss-lib

# 2. Build the project
mvn clean install -DskipTests

# 3. Run a quick verification
mvn test -Dtest="**/*Test" -Dmaven.test.failure.ignore=true

# 4. You're ready! 🎉
```

## 📦 Step 1: Get the Library

### Option 1: Add as Maven Dependency (Recommended)

Add to your `pom.xml`:

```xml
<dependencies>
    <!-- Core OpenFrame API Library -->
    <dependency>
        <groupId>com.openframe</groupId>
        <artifactId>openframe-api-lib</artifactId>
        <version>latest</version>
    </dependency>
    
    <!-- MongoDB Data Models -->
    <dependency>
        <groupId>com.openframe</groupId>
        <artifactId>openframe-data-mongo</artifactId>
        <version>latest</version>
    </dependency>
    
    <!-- Core Utilities -->
    <dependency>
        <groupId>com.openframe</groupId>
        <artifactId>openframe-core</artifactId>
        <version>latest</version>
    </dependency>
</dependencies>
```

### Option 2: Clone and Build Locally

```bash
# Clone the repository
git clone https://github.com/openframe/openframe-oss-lib.git
cd openframe-oss-lib

# Build all modules
mvn clean install
```

## ⚡ Step 2: Hello OpenFrame - First Integration

Create a simple Java application that uses OpenFrame DTOs:

### Create Your Project Structure

```bash
mkdir openframe-hello-world
cd openframe-hello-world

# Create Maven structure
mkdir -p src/main/java/com/example/hello
```

### Basic `pom.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.example</groupId>
    <artifactId>openframe-hello-world</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    
    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>com.openframe</groupId>
            <artifactId>openframe-api-lib</artifactId>
            <version>latest</version>
        </dependency>
        <dependency>
            <groupId>com.openframe</groupId>
            <artifactId>openframe-core</artifactId>
            <version>latest</version>
        </dependency>
    </dependencies>
</project>
```

### Your First OpenFrame Application

Create `src/main/java/com/example/hello/HelloOpenFrame.java`:

```java
package com.example.hello;

import com.openframe.api.dto.device.DeviceFilterOptions;
import com.openframe.api.dto.shared.CursorPaginationInput;
import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.ContactPersonDto;
import com.openframe.api.dto.organization.AddressDto;
import com.openframe.core.util.SlugUtil;

public class HelloOpenFrame {
    
    public static void main(String[] args) {
        System.out.println("🚀 Hello OpenFrame OSS Library!");
        
        // Example 1: Working with Pagination
        demonstratePagination();
        
        // Example 2: Creating Organization DTOs
        demonstrateOrganizationCreation();
        
        // Example 3: Device Filtering
        demonstrateDeviceFiltering();
        
        // Example 4: Utility Functions
        demonstrateUtilities();
        
        System.out.println("✅ OpenFrame integration successful!");
    }
    
    private static void demonstratePagination() {
        System.out.println("\n📄 Cursor Pagination Example:");
        
        CursorPaginationInput pagination = CursorPaginationInput.builder()
            .limit(10)
            .cursor("eyJpZCI6IjEyMyJ9")  // Base64 encoded cursor
            .build();
            
        System.out.println("  Limit: " + pagination.getLimit());
        System.out.println("  Cursor: " + pagination.getCursor());
    }
    
    private static void demonstrateOrganizationCreation() {
        System.out.println("\n🏢 Organization DTO Example:");
        
        // Create address
        AddressDto address = AddressDto.builder()
            .street("123 MSP Street")
            .city("Tech City")
            .state("CA")
            .postalCode("90210")
            .country("USA")
            .build();
            
        // Create contact person
        ContactPersonDto contact = ContactPersonDto.builder()
            .firstName("John")
            .lastName("Doe")
            .email("john.doe@example.com")
            .phone("+1-555-0123")
            .build();
            
        // Create organization request
        CreateOrganizationRequest orgRequest = CreateOrganizationRequest.builder()
            .name("Example MSP Company")
            .website("https://example-msp.com")
            .address(address)
            .primaryContact(contact)
            .build();
            
        System.out.println("  Organization: " + orgRequest.getName());
        System.out.println("  Contact: " + contact.getFirstName() + " " + contact.getLastName());
        System.out.println("  Address: " + address.getCity() + ", " + address.getState());
    }
    
    private static void demonstrateDeviceFiltering() {
        System.out.println("\n💻 Device Filtering Example:");
        
        DeviceFilterOptions filterOptions = DeviceFilterOptions.builder()
            .build();
            
        System.out.println("  Device filter options created successfully");
        System.out.println("  Ready for device queries with pagination and filtering");
    }
    
    private static void demonstrateUtilities() {
        System.out.println("\n🔧 Utility Functions Example:");
        
        String companyName = "Example MSP Company";
        String slug = SlugUtil.generateSlug(companyName);
        
        System.out.println("  Original: " + companyName);
        System.out.println("  Slug: " + slug);
    }
}
```

## 🏃‍♂️ Step 3: Run Your Application

```bash
# Compile and run
mvn clean compile exec:java -Dexec.mainClass="com.example.hello.HelloOpenFrame"
```

### Expected Output

```text
🚀 Hello OpenFrame OSS Library!

📄 Cursor Pagination Example:
  Limit: 10
  Cursor: eyJpZCI6IjEyMyJ9

🏢 Organization DTO Example:
  Organization: Example MSP Company
  Contact: John Doe
  Address: Tech City, CA

💻 Device Filtering Example:
  Device filter options created successfully
  Ready for device queries with pagination and filtering

🔧 Utility Functions Example:
  Original: Example MSP Company
  Slug: example-msp-company

✅ OpenFrame integration successful!
```

## 🎯 Step 4: Verify Integration Features

Let's test some key OpenFrame patterns:

### Validation Testing

Create `src/main/java/com/example/hello/ValidationExample.java`:

```java
package com.example.hello;

import com.openframe.api.dto.shared.CursorPaginationInput;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;

public class ValidationExample {
    
    public static void main(String[] args) {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        Validator validator = factory.getValidator();
        
        // Test invalid pagination (limit too high)
        CursorPaginationInput invalidPagination = CursorPaginationInput.builder()
            .limit(150)  // Exceeds max of 100
            .cursor("test-cursor")
            .build();
            
        Set<ConstraintViolation<CursorPaginationInput>> violations = 
            validator.validate(invalidPagination);
            
        if (!violations.isEmpty()) {
            System.out.println("✅ Validation working! Found " + violations.size() + " violations:");
            violations.forEach(v -> 
                System.out.println("  - " + v.getMessage())
            );
        }
        
        // Test valid pagination
        CursorPaginationInput validPagination = CursorPaginationInput.builder()
            .limit(10)  // Within valid range
            .cursor("test-cursor")
            .build();
            
        Set<ConstraintViolation<CursorPaginationInput>> validViolations = 
            validator.validate(validPagination);
            
        if (validViolations.isEmpty()) {
            System.out.println("✅ Valid pagination object created successfully!");
        }
    }
}
```

Run it:
```bash
mvn clean compile exec:java -Dexec.mainClass="com.example.hello.ValidationExample"
```

## 📊 What You Just Accomplished

Congratulations! In just 5 minutes, you've:

- ✅ **Integrated OpenFrame OSS Library** into a Java project
- ✅ **Used Core DTOs** like `CursorPaginationInput` and organization models
- ✅ **Implemented Validation** with Jakarta Bean Validation
- ✅ **Applied Utility Functions** like slug generation
- ✅ **Followed OpenFrame Patterns** for pagination and data modeling

## 🎨 Common Patterns You Can Use Now

### 1. Paginated API Requests
```java
// Standard pagination for any list endpoint
CursorPaginationInput pagination = CursorPaginationInput.builder()
    .limit(25)
    .cursor(nextCursor)
    .build();
```

### 2. Organization Management
```java
// Creating organizations with full contact info
CreateOrganizationRequest request = CreateOrganizationRequest.builder()
    .name("My MSP")
    .website("https://my-msp.com")
    .address(addressDto)
    .primaryContact(contactDto)
    .build();
```

### 3. Device Operations
```java
// Device filtering with options
DeviceFilterOptions filters = DeviceFilterOptions.builder()
    // Add specific filters as needed
    .build();
```

## ⚡ Next Steps

Now that you have OpenFrame working, here are immediate next actions:

### Immediate (Next 10 minutes)
1. **[Explore First Steps](first-steps.md)** - Learn the 5 essential patterns
2. **Check out core features** - Dive deeper into device, event, and tool management

### Short Term (Next Hour)  
1. **[Architecture Overview](../development/architecture/overview.md)** - Understand the full system design
2. **[Local Development Setup](../development/setup/local-development.md)** - Set up a complete dev environment

### Medium Term (Next Day)
1. **Build a real integration** using the service interfaces
2. **Connect to MongoDB** for persistent data storage
3. **Explore authentication patterns** with the security modules

## 🆘 Troubleshooting

### Build Issues
```bash
# Clear Maven cache
rm -rf ~/.m2/repository/com/openframe

# Clean rebuild
mvn clean install -U
```

### Dependency Conflicts
```bash
# Check dependency tree
mvn dependency:tree

# Resolve conflicts by excluding transitive dependencies in pom.xml
<dependency>
    <groupId>com.openframe</groupId>
    <artifactId>openframe-api-lib</artifactId>
    <version>latest</version>
    <exclusions>
        <exclusion>
            <groupId>conflicting-group</groupId>
            <artifactId>conflicting-artifact</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

### IDE Issues
- **IntelliJ**: File → Reload Maven Projects
- **Eclipse**: Right-click project → Maven → Reload Projects  
- **VS Code**: `Ctrl+Shift+P` → "Java: Reload Projects"

## 🤝 Get Help

- **Questions?** Join [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **Documentation**: [OpenFrame Docs](https://openframe.ai)
- **Examples**: Check the test files in the repository for more usage patterns

---

**🎉 Awesome work!** You've successfully integrated OpenFrame OSS Library. Ready to explore what you can build with it?