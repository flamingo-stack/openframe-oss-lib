# Quick Start

Get up and running with **openframe-oss-lib** in 5 minutes.

---

## TL;DR

```bash
# 1. Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# 2. Build the full library (skip tests for speed)
mvn install -DskipTests

# 3. Verify the build
mvn verify -pl openframe-core -DskipTests
```

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib
```

The repository contains 30+ Maven modules under a single parent POM at the root.

---

## Step 2 — Configure GitHub Packages (Required for Dependency Resolution)

Add your GitHub credentials to `~/.m2/settings.xml`:

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

> A GitHub Personal Access Token (PAT) with `read:packages` scope is required. See the [Prerequisites Guide](prerequisites.md) for details.

---

## Step 3 — Build the Library

Build all modules without running tests for the fastest initial setup:

```bash
mvn install -DskipTests
```

Expected output:

```text
[INFO] Reactor Summary for OpenFrame OSS Libraries 5.79.3:
[INFO]
[INFO] openframe-exception ....................  SUCCESS [  3.5 s]
[INFO] openframe-core ........................  SUCCESS [  2.1 s]
[INFO] openframe-core-crypto .................  SUCCESS [  1.8 s]
[INFO] openframe-data-mongo-common ...........  SUCCESS [  4.2 s]
...
[INFO] BUILD SUCCESS
```

---

## Step 4 — Add a Module as a Dependency

To use a specific module in your own Spring Boot service, add the parent BOM and the desired dependency to your `pom.xml`:

```xml
<dependencyManagement>
  <dependencies>
    <!-- Import the OpenFrame OSS BOM -->
    <dependency>
      <groupId>com.openframe.oss</groupId>
      <artifactId>openframe-oss-lib</artifactId>
      <version>5.79.3</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <!-- Example: Add core module -->
  <dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-core</artifactId>
  </dependency>

  <!-- Example: Add MongoDB sync support -->
  <dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-data-mongo-sync</artifactId>
  </dependency>

  <!-- Example: Add API service core -->
  <dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-api-service-core</artifactId>
  </dependency>
</dependencies>
```

---

## Step 5 — Run Tests for a Specific Module

To run tests for a single module:

```bash
# Run unit tests only for a specific module
mvn test -pl openframe-core

# Run integration tests (requires Docker)
mvn verify -pl openframe-data-mongo-sync
```

> Integration tests use Testcontainers and require a running Docker daemon.

---

## Available Modules — Quick Reference

| Module | GroupId | Description |
|--------|---------|-------------|
| `openframe-core` | `com.openframe.oss` | Core utilities, pagination, validation |
| `openframe-exception` | `com.openframe.oss` | Standard exception hierarchy |
| `openframe-core-crypto` | `com.openframe.oss` | Encryption utilities |
| `openframe-security-core` | `com.openframe.oss` | JWT, PKCE, cookie service |
| `openframe-security-oauth` | `com.openframe.oss` | OAuth2 BFF layer |
| `openframe-authorization-service-core` | `com.openframe.oss` | Multi-tenant OAuth2 auth server |
| `openframe-api-lib` | `com.openframe.oss` | API contracts, filter DTOs |
| `openframe-api-service-core` | `com.openframe.oss` | REST + GraphQL API service layer |
| `openframe-gateway-service-core` | `com.openframe.oss` | Reactive gateway, routing, security |
| `openframe-data-mongo-common` | `com.openframe.oss` | MongoDB domain documents |
| `openframe-data-mongo-sync` | `com.openframe.oss` | Synchronous MongoDB repositories |
| `openframe-data-mongo-reactive` | `com.openframe.oss` | Reactive MongoDB repositories |
| `openframe-data-redis` | `com.openframe.oss` | Redis cache configuration |
| `openframe-data-kafka` | `com.openframe.oss` | Kafka multi-tenant configuration |
| `openframe-data-nats` | `com.openframe.oss` | NATS real-time messaging |
| `openframe-data-cassandra` | `com.openframe.oss` | Cassandra log storage |
| `openframe-data-pinot` | `com.openframe.oss` | Apache Pinot analytics |
| `openframe-management-service-core` | `com.openframe.oss` | Schedulers, initializers |
| `openframe-stream-service-core` | `com.openframe.oss` | Kafka streams, event enrichment |
| `openframe-external-api-service-core` | `com.openframe.oss` | External REST API |
| `sdk/fleetmdm` | `com.openframe.oss` | Fleet MDM Java SDK |

---

## Expected Results

After a successful `mvn install -DskipTests` you should see:

```text
[INFO] BUILD SUCCESS
[INFO] Total time: 2-4 minutes (depending on hardware)
[INFO] Finished at: ...
```

All modules are installed into your local Maven repository (`~/.m2/repository/com/openframe/oss/`).

---

## Video Walkthrough

[![Getting Started with OpenFrame - Organization Setup Basics](https://img.youtube.com/vi/-_56_qYvMWk/maxresdefault.jpg)](https://www.youtube.com/watch?v=-_56_qYvMWk)

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| `Could not resolve dependencies` | Check `~/.m2/settings.xml` for GitHub credentials |
| `OutOfMemoryError` during build | Set `export MAVEN_OPTS="-Xmx4g"` |
| Integration tests fail | Ensure Docker daemon is running |
| `flatten-maven-plugin` errors | Upgrade Maven to 3.9+ |

---

## Next Steps

After building successfully, explore:

- [First Steps Guide](first-steps.md) for key module walkthroughs
- [Development Environment Setup](../development/setup/environment.md) for IDE configuration
- [Architecture Overview](../development/architecture/README.md) for system design patterns
