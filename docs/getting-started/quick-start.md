# Quick Start

Get `openframe-oss-lib` cloned and compiled in under 5 minutes.

[![OpenFrame Product Walkthrough (Beta Access)](https://img.youtube.com/vi/awc-yAnkhIo/maxresdefault.jpg)](https://www.youtube.com/watch?v=awc-yAnkhIo)

---

## TL;DR

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Build all modules (skip tests for speed)
mvn install -DskipTests
```

That's it. The library modules are now available in your local Maven repository.

---

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib
```

### 2. Verify Java 21

```bash
java -version
```

Expected output:

```text
openjdk version "21.x.x" ...
```

### 3. Configure GitHub Packages Access

This repository publishes to GitHub Packages. Add your credentials to `~/.m2/settings.xml`:

```xml
<settings>
  <servers>
    <server>
      <id>github</id>
      <username>YOUR_GITHUB_USERNAME</username>
      <password>YOUR_GITHUB_PAT</password>
    </server>
  </servers>
</settings>
```

### 4. Build All Modules

```bash
mvn install -DskipTests
```

This will build all 30+ modules in dependency order and install them into your local Maven repository.

**Expected output:**

```text
[INFO] Reactor Summary for OpenFrame OSS Libraries 6.0.10:
[INFO] OpenFrame OSS Libraries ........................... SUCCESS
[INFO] openframe-exception ............................... SUCCESS
[INFO] openframe-core .................................... SUCCESS
[INFO] openframe-core-crypto ............................. SUCCESS
[INFO] openframe-data-mongo-common ....................... SUCCESS
[INFO] openframe-data-mongo-sync ......................... SUCCESS
...
[INFO] BUILD SUCCESS
```

### 5. Build a Specific Module

If you only need to work on one module:

```bash
# Example: build only the API service core module
mvn install -pl openframe-api-service-core -am -DskipTests
```

The `-am` flag builds all modules that `openframe-api-service-core` depends on.

---

## Using the Library in Your Project

Once built, add individual modules as Maven dependencies:

```xml
<!-- Add to your service's pom.xml -->
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-api-service-core</artifactId>
    <version>6.0.10</version>
</dependency>

<!-- Or use the BOM for consistent versioning -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.openframe.oss</groupId>
            <artifactId>openframe-oss-lib</artifactId>
            <version>6.0.10</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

---

## Available Modules (Quick Reference)

| Module Artifact ID | Description |
|-------------------|-------------|
| `openframe-core` | Core utilities (pagination, constants, slug) |
| `openframe-exception` | Shared exception hierarchy and error codes |
| `openframe-security-core` | JWT encoder/decoder, PKCE utilities |
| `openframe-security-oauth` | OAuth BFF controller and token cookies |
| `openframe-api-lib` | Shared DTO contracts and domain services |
| `openframe-api-service-core` | REST + GraphQL API service core |
| `openframe-authorization-service-core` | OAuth2/OIDC Authorization Server |
| `openframe-gateway-service-core` | Reactive API Gateway |
| `openframe-client-core` | Agent registration and ingress |
| `openframe-management-service-core` | Management services and schedulers |
| `openframe-data-mongo-common` | MongoDB domain documents |
| `openframe-data-mongo-sync` | MongoDB sync repositories |
| `openframe-data-mongo-reactive` | Reactive MongoDB repositories |
| `openframe-data-redis` | Redis cache and rate-limit support |
| `openframe-data-kafka` | Kafka producers and configuration |
| `openframe-data-nats` | NATS messaging publishers |
| `openframe-data-pinot` | Apache Pinot query repositories |
| `openframe-stream-service-core` | Kafka Streams and CDC processing |
| `openframe-external-api-service-core` | External REST API for consumers |
| `openframe-debezium-initializer` | Debezium connector lifecycle |
| `openframe-pinot-initializer` | Pinot schema initialization |
| `fleetmdm` | Fleet MDM SDK |
| `tacticalrmm` | Tactical RMM SDK |
| `openframe-test-service-core` | E2E test utilities |

---

## Running Unit Tests

```bash
# Run all unit tests
mvn test

# Run tests for a single module
mvn test -pl openframe-api-service-core
```

## Running Integration Tests

Integration tests require Docker to be running (for MongoDB, Redis, NATS, etc.):

```bash
# Run integration tests (requires Docker)
mvn verify -pl openframe-data-mongo-sync
```

---

## Expected Results

After a successful build:

- All module JARs are installed in your local Maven repository under `~/.m2/repository/com/openframe/oss/`
- You can import and extend any module in your downstream Spring Boot services
- The complete OpenFrame library stack is available as a dependency BOM

---

## Next Steps

- Follow the **[First Steps Guide](first-steps.md)** to explore the key modules
- Review the **[Prerequisites](prerequisites.md)** if you encounter build issues
- Explore the architecture docs in `./reference/architecture/` for detailed module design
