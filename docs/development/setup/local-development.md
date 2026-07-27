# Local Development Guide

This guide walks through setting up OpenFrame OSS Lib for active local development, including hot-reload patterns and debug configurations.

---

## Clone and Initial Setup

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Verify your Java version (must be 21)
java -version

# Build everything without tests (fastest first-time setup)
mvn clean install -DskipTests
```

> The build uses `${revision}` CI-friendly versioning managed by the **flatten-maven-plugin**. The default version is `999-SNAPSHOT`. This is resolved at build time — no manual version changes required.

---

## Working with Individual Modules

Rather than rebuilding the entire monorepo on every change, work with individual modules:

```bash
# Build only a specific module and its dependencies
mvn clean install -pl openframe-data-mongo-sync -am -DskipTests

# Build only a module without rebuilding dependencies (when deps are already installed)
mvn clean install -pl openframe-api-service-core -DskipTests
```

### Module Dependency Resolution

Use this flag to include transitive local dependencies:

- `-am` (also-make): Builds all upstream modules that the target depends on
- `-amd` (also-make-dependents): Builds all modules that depend on the target

```bash
# I changed openframe-core — rebuild it and everything that depends on it
mvn clean install -pl openframe-core -amd -DskipTests
```

---

## Running Tests Locally

### Unit Tests

```bash
# All tests in a module
mvn test -pl openframe-api-service-core

# A specific test class
mvn test -pl openframe-api-service-core -Dtest=ScriptDataFetcherTest

# A specific test method
mvn test -pl openframe-api-service-core -Dtest="ScriptDataFetcherTest#shouldReturnScripts"
```

### Integration Tests (Testcontainers)

Integration tests use Testcontainers to spin up real MongoDB, NATS, or Redis instances. Ensure Docker is running first.

```bash
# Run integration tests for the data sync module
mvn verify -pl openframe-data-mongo-sync

# Include both unit and integration tests
mvn verify -pl openframe-data-nats
```

Integration test classes follow the naming convention `*IT.java` or `*IntegrationTest.java`.

### Skipping Tests

```bash
# Skip test compilation and execution
mvn clean install -DskipTests

# Compile tests but skip execution
mvn clean install -Dmaven.test.skip=false -DskipTests
```

---

## Frontend Local Development

### Storybook (Component Explorer)

```bash
cd openframe-frontend-core
npm install
npm run storybook
```

Storybook starts at `http://localhost:6006` and provides an interactive component browser. All stories are in `src/stories/`.

### Watch Mode (Library Build)

For changes that need to be reflected in a consuming app:

```bash
cd openframe-frontend-core
npm run build -- --watch
```

### Unit Tests (Vitest)

```bash
cd openframe-frontend-core
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

---

## Rust Agent Local Development

```bash
cd clients/openframe-client

# Fast compilation check (no binary output)
cargo check

# Run unit tests
cargo test

# Run with logging
RUST_LOG=debug cargo run -- --help

# Format code
cargo fmt

# Lint check
cargo clippy -- -D warnings
```

### Development Script

A setup script is available for agent initialization configuration:

```bash
# Located at:
clients/openframe-client/scripts/setup_dev_init_config.sh

# Make executable and run (review contents first)
chmod +x clients/openframe-client/scripts/setup_dev_init_config.sh
./clients/openframe-client/scripts/setup_dev_init_config.sh
```

---

## Debug Configuration

### Debugging Java Modules with IntelliJ

When running a service that uses these library modules, attach the IntelliJ debugger:

1. Add remote JVM debug flags to the service startup:
   ```bash
   java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005 -jar your-service.jar
   ```

2. In IntelliJ: Run → Edit Configurations → Add → Remote JVM Debug
   - Host: `localhost`
   - Port: `5005`

3. Set breakpoints in library source files — IntelliJ will resolve them via source attachments.

### Library Source in Consuming Projects

When the consuming project (e.g., `openframe-oss-tenant`) depends on `openframe-oss-lib` via Maven, IntelliJ automatically resolves sources if you have the library project open or the `-sources.jar` artifacts available.

The Maven Source Plugin is configured in the parent POM to produce `-sources.jar` for all modules:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-source-plugin</artifactId>
    <version>3.3.0</version>
    <executions>
        <execution>
            <id>attach-sources</id>
            <goals><goal>jar</goal></goals>
        </execution>
    </executions>
</plugin>
```

---

## Hot Reload Patterns

### Spring Boot DevTools (Service Level)

The library modules themselves don't run as standalone services. Hot reload applies at the consuming service level. Add to your consuming service:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
    <scope>runtime</scope>
    <optional>true</optional>
</dependency>
```

### Frontend Hot Module Replacement

Storybook provides HMR out of the box. The watch build (`npm run build -- --watch`) pairs with HMR in consuming apps.

---

## Common Development Tasks

### Add a New MongoDB Document

1. Create the document class in `openframe-data-mongo-common`:
   ```java
   // openframe-data-mongo-common/.../document/mymodule/MyDocument.java
   @Document(collection = "my_collection")
   @Data
   @Builder
   public class MyDocument implements TenantScoped {
       @Id
       private String id;
       private String tenantId;
       // fields...
   }
   ```

2. Add the repository in `openframe-data-mongo-sync`:
   ```java
   public interface MyDocumentRepository extends TenantAwareRepository<MyDocument, String> {
       // custom query methods
   }
   ```

3. Build both modules:
   ```bash
   mvn clean install -pl openframe-data-mongo-common,openframe-data-mongo-sync -DskipTests
   ```

### Add a New GraphQL Data Fetcher

1. Create the DGS component in `openframe-api-service-core`:
   ```java
   @DgsComponent
   public class MyDataFetcher {
       @DgsQuery
       public MyType myQuery(@InputArgument MyInput input) {
           // ...
       }
   }
   ```

2. Register the schema in `src/main/resources/schema/`:
   ```text
   type Query {
     myQuery(input: MyInput): MyType
   }
   ```

3. Rebuild:
   ```bash
   mvn clean install -pl openframe-api-service-core -DskipTests
   ```

---

## Useful Maven Commands Reference

```bash
# List all modules
mvn help:evaluate -Dexpression=project.modules -q

# Check effective POM (resolved properties)
mvn help:effective-pom -pl openframe-core

# Dependency tree for a module
mvn dependency:tree -pl openframe-api-service-core

# Find which module declares a dependency
mvn dependency:resolve -pl openframe-gateway-service-core

# Clean only (no rebuild)
mvn clean

# Skip specific tests
mvn test -pl openframe-data-mongo-sync -Dtest="!*IT*"
```
