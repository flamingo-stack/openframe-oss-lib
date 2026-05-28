# Local Development Guide

This guide covers everything you need to know for developing OpenFrame OSS Lib locally, including cloning, building, testing, and iterative development workflows.

## Quick Start for Local Development

```bash
# 1. Clone the repository
git clone https://github.com/openframe/openframe-oss-lib.git
cd openframe-oss-lib

# 2. Build the project
./mvnw clean compile

# 3. Run tests
./mvnw test

# 4. Install to local Maven repository
./mvnw install

# 5. Start development
# Open in your IDE and start coding!
```

## Repository Setup

### Cloning the Repository

```bash
# For core team members (direct access)
git clone git@github.com:openframe/openframe-oss-lib.git

# For external contributors (fork-based)
gh repo fork openframe/openframe-oss-lib --clone=true

# Navigate to project
cd openframe-oss-lib
```

### Project Structure Overview

```text
openframe-oss-lib/
├── 📄 .gitignore                    # Git ignore patterns
├── 📄 .mvn/                         # Maven wrapper configuration
├── 📄 mvnw                          # Maven wrapper script (Unix)
├── 📄 mvnw.cmd                      # Maven wrapper script (Windows)
├── 📄 pom.xml                       # Root project configuration
├── 📁 openframe-api-lib/            # Main library module
│   ├── 📄 pom.xml                   # Module configuration
│   └── 📁 src/
│       ├── 📁 main/java/            # Production source code
│       │   └── 📁 com/openframe/api/dto/
│       │       ├── 📄 GenericQueryResult.java
│       │       ├── 📄 CountedGenericQueryResult.java
│       │       ├── 📁 audit/        # Audit-related DTOs
│       │       └── 📁 device/       # Device-related DTOs
│       └── 📁 test/java/            # Test source code (if present)
├── 📁 docs/                         # Documentation
└── 📁 .github/                      # GitHub workflows and templates
```

### Initial Verification

```bash
# Verify Java and Maven are working
java -version
./mvnw --version

# Check project structure
find . -name "*.java" | head -10

# Verify all dependencies can be resolved
./mvnw dependency:resolve
```

## Build System

### Maven Wrapper Usage

Always use the Maven wrapper (`./mvnw`) for consistency:

```bash
# Build project
./mvnw clean compile

# Run tests
./mvnw test

# Package JAR
./mvnw package

# Install to local repository
./mvnw install

# Clean all build artifacts
./mvnw clean
```

### Common Build Commands

```bash
# Full clean build with tests
./mvnw clean test

# Quick compilation without tests
./mvnw compile -DskipTests

# Build and install locally
./mvnw clean install

# Generate project reports
./mvnw site

# Check for dependency updates
./mvnw versions:display-dependency-updates
```

### Build Profiles

Configure different build profiles in `pom.xml`:

```xml
<profiles>
    <!-- Development profile (default) -->
    <profile>
        <id>dev</id>
        <activation>
            <activeByDefault>true</activeByDefault>
        </activation>
        <properties>
            <skipTests>false</skipTests>
            <maven.javadoc.skip>true</maven.javadoc.skip>
        </properties>
    </profile>
    
    <!-- Production profile -->
    <profile>
        <id>prod</id>
        <properties>
            <skipTests>false</skipTests>
            <maven.javadoc.skip>false</maven.javadoc.skip>
        </properties>
    </profile>
    
    <!-- Fast development profile -->
    <profile>
        <id>fast</id>
        <properties>
            <skipTests>true</skipTests>
            <maven.test.skip>true</maven.test.skip>
        </properties>
    </profile>
</profiles>
```

Use profiles:
```bash
# Fast build without tests
./mvnw clean compile -Pfast

# Production build with all checks
./mvnw clean package -Pprod
```

## Development Workflow

### Setting Up Your Feature Branch

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/add-new-dto-type
```

### Iterative Development

```bash
# Edit source files in your IDE
# src/main/java/com/openframe/api/dto/NewDTO.java

# Quick compile check
./mvnw compile

# Run specific tests
./mvnw test -Dtest=NewDTOTest

# Run all tests
./mvnw test

# Format code (if formatter configured)
./mvnw spotless:apply
```

### Hot Reload Development

For rapid development cycles:

```bash
# Terminal 1: Watch for changes and auto-compile
while inotifywait -r src/; do ./mvnw compile; done

# Terminal 2: Run tests continuously
./mvnw test -Dmaven.test.failure.ignore=true -Dtest="**/*Test" -Dsurefire.rerunFailingTestsCount=1
```

### IDE Integration

#### IntelliJ IDEA

```bash
# Open project
idea .

# Or open specific module
idea openframe-api-lib/
```

**Useful IntelliJ shortcuts:**
- `Ctrl+Shift+F10` - Run current test
- `Ctrl+F9` - Build project
- `Alt+Shift+F10` - Run configuration
- `Ctrl+Shift+R` - Replace in path

#### Eclipse

```bash
# Import as existing Maven project
File > Import > Existing Maven Projects > Browse to openframe-oss-lib
```

#### VS Code

```bash
# Open in VS Code
code .

# Or open specific module
code openframe-api-lib/
```

## Running Tests

### Test Structure

```text
src/test/java/
├── 📁 com/openframe/api/dto/
│   ├── 📄 GenericQueryResultTest.java
│   ├── 📄 CountedGenericQueryResultTest.java
│   ├── 📁 audit/
│   │   ├── 📄 LogEventTest.java
│   │   └── 📄 LogFilterCriteriaTest.java
│   └── 📁 device/
│       ├── 📄 DeviceFilterCriteriaTest.java
│       └── 📄 DeviceFiltersTest.java
└── 📁 integration/
    └── 📄 DTOSerializationTest.java
```

### Running Tests

```bash
# All tests
./mvnw test

# Specific test class
./mvnw test -Dtest=LogEventTest

# Test pattern
./mvnw test -Dtest="*Filter*Test"

# Integration tests only
./mvnw test -Dtest="**/*IntegrationTest"

# Skip integration tests  
./mvnw test -DexcludeGroups="integration"

# Run tests with detailed output
./mvnw test -X

# Generate test reports
./mvnw surefire-report:report
open target/site/surefire-report.html
```

### Writing New Tests

Example test for a new DTO:

```java
package com.openframe.api.dto;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

class MyNewDTOTest {
    
    @Test
    @DisplayName("Should build DTO with all required fields")
    void shouldBuildDTOWithAllFields() {
        // Given
        String expectedId = "test_123";
        String expectedName = "Test Name";
        
        // When
        MyNewDTO dto = MyNewDTO.builder()
            .id(expectedId)
            .name(expectedName)
            .build();
        
        // Then
        assertNotNull(dto);
        assertEquals(expectedId, dto.getId());
        assertEquals(expectedName, dto.getName());
    }
    
    @Test
    @DisplayName("Should handle null values gracefully")
    void shouldHandleNullValues() {
        // When/Then - should not throw exceptions
        assertDoesNotThrow(() -> {
            MyNewDTO dto = MyNewDTO.builder().build();
            assertNull(dto.getId());
            assertNull(dto.getName());
        });
    }
    
    @Test  
    @DisplayName("Should support JSON serialization")
    void shouldSerializeToJson() throws Exception {
        // Given
        MyNewDTO dto = MyNewDTO.builder()
            .id("test_123")
            .name("Test Name")
            .build();
        
        ObjectMapper mapper = new ObjectMapper();
        
        // When
        String json = mapper.writeValueAsString(dto);
        MyNewDTO deserialized = mapper.readValue(json, MyNewDTO.class);
        
        // Then
        assertEquals(dto.getId(), deserialized.getId());
        assertEquals(dto.getName(), deserialized.getName());
    }
}
```

## Debug Configuration

### IntelliJ IDEA Debug Setup

1. **Create Run Configuration:**
   ```text
   Run > Edit Configurations > + > Application
   Main class: com.example.TestApp
   VM options: -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005
   ```

2. **Remote Debug Configuration:**
   ```text
   Run > Edit Configurations > + > Remote JVM Debug
   Host: localhost
   Port: 5005
   ```

### Maven Debug

```bash
# Debug tests
./mvnw test -Dmaven.surefire.debug

# Debug with custom port
./mvnw test -Dmaven.surefire.debug="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8000"

# Debug specific test
./mvnw test -Dtest=LogEventTest -Dmaven.surefire.debug
```

## Code Quality Tools

### Formatting and Style

```bash
# Check code formatting (if configured)
./mvnw spotless:check

# Apply automatic formatting
./mvnw spotless:apply

# Check style violations
./mvnw checkstyle:check

# Generate checkstyle report
./mvnw checkstyle:checkstyle
```

### Static Analysis

```bash
# Run SpotBugs analysis
./mvnw spotbugs:check

# Generate SpotBugs report
./mvnw spotbugs:spotbugs

# PMD analysis
./mvnw pmd:check

# Generate PMD report  
./mvnw pmd:pmd
```

## Dependency Management

### Viewing Dependencies

```bash
# Dependency tree
./mvnw dependency:tree

# Dependency analysis
./mvnw dependency:analyze

# Check for dependency conflicts
./mvnw dependency:tree -Dverbose

# Find specific dependency usage
./mvnw dependency:tree -Dincludes=org.projectlombok:lombok
```

### Updating Dependencies

```bash
# Check for updates
./mvnw versions:display-dependency-updates

# Update to latest versions (be careful!)
./mvnw versions:use-latest-versions

# Update specific dependency
./mvnw versions:use-latest-versions -Dincludes=org.junit.jupiter:*
```

## Local Integration Testing

### Testing with Local Projects

```bash
# Install current development version
./mvnw install

# Use in another local project
# Add to other project's pom.xml:
```

```xml
<dependency>
    <groupId>com.openframe.api</groupId>
    <artifactId>openframe-api-lib</artifactId>
    <version>1.0-SNAPSHOT</version>
</dependency>
```

### JSON Serialization Testing

Create `integration-test.java`:
```java
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.api.dto.*;

public class SerializationTest {
    public static void main(String[] args) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        
        // Test serialization
        LogEvent event = LogEvent.builder()
            .id("test_001")
            .summary("Test event")
            .eventType("TEST")
            .build();
            
        String json = mapper.writeValueAsString(event);
        System.out.println("Serialized: " + json);
        
        LogEvent deserialized = mapper.readValue(json, LogEvent.class);
        System.out.println("Deserialized: " + deserialized);
    }
}
```

```bash
# Compile and run
./mvnw exec:java -Dexec.mainClass="SerializationTest"
```

## Performance Monitoring

### Build Performance

```bash
# Profile Maven build
./mvnw clean compile -X | grep "Total time"

# Parallel builds (faster for multi-module projects)
./mvnw clean compile -T 1C  # 1 thread per CPU core

# Offline builds (skip dependency checks)
./mvnw clean compile -o
```

### Memory Usage Monitoring

```bash
# Monitor JVM during development
export MAVEN_OPTS="-Xmx2048m -XX:+PrintGCDetails -XX:+PrintGCTimeStamps"
./mvnw clean test
```

## Troubleshooting Local Development

### Common Issues

**Maven wrapper not executable:**
```bash
chmod +x mvnw
./mvnw --version
```

**IDE not recognizing changes:**
```bash
# Force refresh in IDE
# IntelliJ: File > Reload Gradle Project / Reimport Maven
# Eclipse: Right-click project > Refresh > Gradle > Refresh Gradle Project
```

**Lombok not working:**
```bash
# Verify annotation processing enabled in IDE
# Check Lombok plugin installed
# Restart IDE after Lombok installation
```

**Port conflicts during testing:**
```bash
# Change test ports if needed
./mvnw test -Dtest.port=8081
```

**Out of memory errors:**
```bash
export MAVEN_OPTS="-Xmx4096m -XX:MaxMetaspaceSize=1024m"
./mvnw clean test
```

### Getting Help

- **Build Issues**: Check Maven output with `-X` flag for detailed logs
- **IDE Problems**: Verify IDE plugins are installed and up to date
- **Test Failures**: Run individual tests to isolate issues
- **Community Support**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)

## Commit and Push Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add new DTO for device configuration

- Create DeviceConfigDTO with validation
- Add builder pattern and Lombok annotations  
- Include comprehensive test coverage
- Update documentation"

# Push to your feature branch
git push origin feature/add-new-dto-type

# Create pull request (if you have permissions)
gh pr create --title "Add DeviceConfigDTO" --body "Implements new device configuration DTO with validation and tests"
```

## Next Steps

With your local development environment working:

1. [**Architecture Overview**](../architecture/README.md) - Understand the codebase design
2. [**Security Guidelines**](../security/README.md) - Learn security best practices
3. [**Testing Guide**](../testing/README.md) - Master the testing strategies
4. [**Contributing Guidelines**](../contributing/guidelines.md) - Learn the contribution workflow

---

*Local development should feel smooth and productive. If you encounter friction in any of these workflows, please let us know so we can improve the developer experience.*