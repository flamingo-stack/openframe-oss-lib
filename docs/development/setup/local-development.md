# Local Development Guide

This guide walks you through setting up the `openframe-oss-lib` project for local development, including building modules, running tests, and debugging.

---

## Clone and Initial Setup

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Verify Java version
java -version
# Should show: openjdk version "21.x.x"
```

---

## Building the Project

### Full Build (All Modules, Skip Tests)

```bash
mvn install -DskipTests
```

This installs all modules to your local Maven cache (`~/.m2/repository`), making them available as dependencies for other local projects.

### Build a Specific Module

```bash
# Build only the core module
mvn install -pl openframe-core -DskipTests

# Build a module and its dependencies
mvn install -pl openframe-api-lib -am -DskipTests

# Build multiple modules at once
mvn install -pl openframe-core,openframe-exception,openframe-data-mongo-common -DskipTests
```

### Clean Build

```bash
# Clean all build outputs and rebuild
mvn clean install -DskipTests
```

---

## Running Tests

### Unit Tests

Unit tests run without Docker and execute quickly:

```bash
# Run tests for a specific module
mvn test -pl openframe-core
mvn test -pl openframe-exception
mvn test -pl openframe-data-pinot

# Run all unit tests across all modules
mvn test
```

### Integration Tests

Integration tests use **Testcontainers** and require Docker:

```bash
# Run integration tests for MongoDB sync module
mvn verify -pl openframe-data-mongo-sync

# Run integration tests for NATS module
mvn verify -pl openframe-data-nats

# Run integration tests for API service core
mvn verify -pl openframe-api-service-core

# Run all integration tests (slow - runs all module verifications)
mvn verify
```

> **Testcontainers** automatically pulls and starts Docker containers for MongoDB, Redis, NATS, and other dependencies. No manual Docker Compose setup is needed for tests.

### Run a Specific Test Class

```bash
# Run a specific test class
mvn test -pl openframe-data-pinot -Dtest=PinotQueryBuilderTest

# Run a specific test method
mvn test -pl openframe-api-service-core -Dtest=CommandDispatchServiceTest#testDispatch
```

---

## Module Development Workflow

### Working on a Data Module

```bash
cd openframe-data-mongo-sync

# Run all tests for this module
mvn test

# Run only integration tests
mvn verify -Dsurefire.skip=true

# Run only unit tests (skip integration)
mvn test -Dfailsafe.skip=true
```

### Working on the API Service Core

```bash
cd openframe-api-service-core

# Build dependencies first
mvn install -pl openframe-core,openframe-exception,openframe-data-mongo-common,\
openframe-data-mongo-sync,openframe-api-lib,openframe-security-core \
-am -DskipTests

# Then run API service core tests
mvn test -pl openframe-api-service-core
```

### Working on Frontend Core

```bash
cd openframe-frontend-core

# Install Node.js dependencies
npm install

# Start Storybook for component development
npm run storybook

# Run unit tests
npm run test

# Build the library
npm run build
```

---

## Debug Configuration

### IntelliJ IDEA Debug

1. Open **Run/Debug Configurations**
2. Add a new **JUnit** configuration
3. Set:
   - **Test kind**: Class
   - **Class**: `com.openframe.data.mongo.sync.SomeTest`
   - **Working directory**: `$MODULE_WORKING_DIR$`
4. Add **JVM options** for Testcontainers if needed:
   ```text
   -Dtestcontainers.reuse.enable=true
   ```

### Enable Testcontainers Container Reuse

To speed up repeated integration test runs by reusing Docker containers:

```bash
# Create or edit ~/.testcontainers.properties
echo "testcontainers.reuse.enable=true" >> ~/.testcontainers.properties
```

---

## CI-Friendly Versioning

The project uses Maven's CI-friendly `${revision}` property. The version is defined in the parent POM:

```xml
<properties>
    <revision>6.0.10</revision>
</properties>
```

The `flatten-maven-plugin` resolves this during the `process-resources` phase. When building:

```bash
# Override version for a specific build
mvn install -Drevision=6.0.11-SNAPSHOT -DskipTests
```

---

## Useful Maven Commands Reference

```bash
# Show effective POM for a module
mvn help:effective-pom -pl openframe-core

# Show dependency tree for a module
mvn dependency:tree -pl openframe-api-service-core

# Check for dependency updates
mvn versions:display-dependency-updates -pl openframe-core

# Validate the POM files
mvn validate

# Show all modules in reactor
mvn help:evaluate -Dexpression=project.modules
```

---

## Local Publishing

To publish artifacts to the GitHub Maven Package Registry (for maintainers with write access):

```bash
# Publish all modules
mvn deploy -DskipTests

# Publish a specific module
mvn deploy -pl openframe-core -DskipTests
```

> This requires GitHub token configuration in `~/.m2/settings.xml` with `write:packages` scope.

---

## Common Issues

| Problem | Solution |
|---------|---------|
| `Compilation failure: cannot find symbol` | Ensure annotation processing is enabled in your IDE; run `mvn generate-sources` |
| `Docker not available` in tests | Ensure Docker daemon is running: `docker info` |
| `Unable to connect to GitHub Packages` | Check `~/.m2/settings.xml` for correct `id=github` server entry |
| `revision` placeholder in deployed POM | The `flatten-maven-plugin` must run — use `mvn install` not `mvn package` |
| Out of memory during build | Increase Maven heap: `export MAVEN_OPTS="-Xmx2g"` |
