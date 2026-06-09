# Local Development Guide

This guide covers cloning the repository, running it locally, working with hot reload, and configuring debug sessions.

---

## Clone and Initial Setup

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Verify Java 21 is active
java -version

# Build all modules (skip tests for faster setup)
mvn install -DskipTests
```

---

## Project Structure for Local Development

This is a **library project**, not a standalone runnable application. Each module compiles to a JAR that is consumed by downstream OpenFrame services.

The recommended local development workflow is:

1. **Make changes** in the `openframe-oss-lib` module you're working on
2. **Build and install** the module to your local Maven repository
3. **Run your downstream service** that depends on it (with the local snapshot version)

```bash
# Install a single module and its dependencies to local repo
mvn install -pl openframe-api-service-core -am -DskipTests

# The JAR is now at:
# ~/.m2/repository/com/openframe/oss/openframe-api-service-core/6.0.10/
```

---

## Starting Local Infrastructure

Some modules have integration tests that require running infrastructure. Start the minimum required services using Docker:

### MongoDB (Required for Most Modules)

```bash
# Start MongoDB for integration tests
cd openframe-data-mongo-sync/src/test/docker
docker compose up -d
cd -
```

### Full Local Stack (Manual Docker)

For a more complete local environment, run the required services individually:

```bash
# MongoDB
docker run -d --name openframe-mongo \
  -p 27017:27017 \
  mongo:7

# Redis
docker run -d --name openframe-redis \
  -p 6379:6379 \
  redis:7-alpine

# NATS with JetStream
docker run -d --name openframe-nats \
  -p 4222:4222 \
  nats:2-alpine -js

# Kafka (using Confluent's image with KRaft mode)
docker run -d --name openframe-kafka \
  -p 9092:9092 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
  confluentinc/cp-kafka:latest
```

---

## Running Module Tests Locally

### Unit Tests

Unit tests use JUnit 5 and Mockito. No infrastructure is required:

```bash
# Run all unit tests
mvn test

# Run unit tests for a specific module
mvn test -pl openframe-api-service-core

# Run a specific test class
mvn test -pl openframe-api-service-core \
  -Dtest=CommandDispatchServiceTest
```

### Integration Tests

Integration tests use **Testcontainers** (version 1.21.4) to spin up Docker containers automatically:

```bash
# Run integration tests for MongoDB sync module
mvn verify -pl openframe-data-mongo-sync

# Run integration tests for NATS module
mvn verify -pl openframe-data-nats
```

Testcontainers will pull the required Docker images on first run.

---

## Working with Maven Multi-Module

### Building Only Changed Modules

Use Maven's `-pl` (project list) and `-am` (also make dependencies) flags:

```bash
# Build the gateway module and everything it depends on
mvn install -pl openframe-gateway-service-core -am -DskipTests

# Build multiple specific modules
mvn install -pl openframe-core,openframe-data-mongo-common -DskipTests
```

### Skipping Test Compilation

For the fastest possible build cycle:

```bash
mvn install -DskipTests -Dmaven.test.skip=true
```

---

## IntelliJ IDEA Local Run Configuration

If you have a downstream Spring Boot service that depends on this library, configure IntelliJ to use local snapshots:

1. **Open the downstream project** in IntelliJ
2. In `pom.xml`, update the version to match your local build (e.g., `6.0.10`)
3. Run `mvn install -DskipTests` in `openframe-oss-lib` to refresh your local `.m2`
4. **Reload Maven** in the downstream project (`Right-click pom.xml → Maven → Reload project`)
5. Run the downstream service with your IDE's Spring Boot run configuration

---

## Useful Maven Commands Reference

| Command | Description |
|---------|-------------|
| `mvn compile` | Compile all sources |
| `mvn test` | Run unit tests |
| `mvn verify` | Run unit + integration tests |
| `mvn install -DskipTests` | Build and install to local repo (no tests) |
| `mvn install -pl MODULE -am` | Build a module with its dependencies |
| `mvn dependency:tree` | Show full dependency tree |
| `mvn dependency:tree -pl MODULE` | Show dependency tree for one module |
| `mvn versions:display-dependency-updates` | Check for dependency version updates |
| `mvn clean` | Remove all build artifacts |

---

## Hot Reload / Watch Mode

Since this is a library (not a runnable application), there is no traditional hot reload. However, you can achieve a fast feedback loop:

### Option 1: IDE Auto-Build

In IntelliJ IDEA:
- Enable `Settings → Build → Build project automatically`
- Use `Ctrl+Shift+F9` (or `Cmd+Shift+F9`) to recompile specific files

### Option 2: Maven Daemon

Use the Maven Daemon for faster builds:

```bash
# Install mvnd (Maven Daemon)
brew install mvnd   # macOS

# Use mvnd instead of mvn for faster incremental builds
mvnd install -pl openframe-api-service-core -am -DskipTests
```

---

## Debug Configuration

### Debugging a Specific Test

In IntelliJ IDEA:
1. Open the test class
2. Set breakpoints
3. Right-click the test method → `Debug 'testMethodName'`

### Remote Debugging a Downstream Service

If you're testing changes in a downstream service, add debug JVM args:

```bash
# Start your downstream Spring Boot service with remote debug
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005 \
  -jar your-service.jar
```

Then in IntelliJ: `Run → Edit Configurations → Add → Remote JVM Debug → Port 5005`

---

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Could not find artifact com.openframe.oss:*` | Module not installed locally | Run `mvn install -DskipTests` in `openframe-oss-lib` |
| `Connection refused: localhost:27017` | MongoDB not running | Start MongoDB Docker container |
| `java.lang.UnsupportedClassVersionError` | Wrong Java version | Switch to Java 21 |
| `BeanCreationException: Unsatisfied dependency` | Missing Spring bean | Check if the required module is on the classpath |
| `Testcontainers failed to start` | Docker not running | Start Docker Desktop |
