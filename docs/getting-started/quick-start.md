# Quick Start

Get up and running with `openframe-oss-lib` in under 5 minutes.

[![Getting Started with OpenFrame - Organization Setup Basics](https://img.youtube.com/vi/-_56_qYvMWk/maxresdefault.jpg)](https://www.youtube.com/watch?v=-_56_qYvMWk)

---

## TL;DR

```bash
# 1. Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# 2. Build all modules (skip tests for speed)
mvn install -DskipTests

# 3. Run tests for a specific module
mvn test -pl openframe-core

# 4. Run integration tests (requires Docker)
mvn verify -pl openframe-data-mongo-sync
```

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib
```

---

## Step 2: Verify the Build

The project uses a `revision` property for CI-friendly versioning. The current version is **6.0.10**.

```bash
# Build all modules, skipping tests
mvn install -DskipTests

# Expected output: BUILD SUCCESS
```

> **Note:** The first build may take several minutes as Maven downloads all dependencies.

---

## Step 3: Use a Module as a Maven Dependency

After a successful local install, you can reference any module in your own project:

```xml
<!-- In your project's pom.xml -->
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-core</artifactId>
    <version>6.0.10</version>
</dependency>
```

For the API contracts module:

```xml
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-api-lib</artifactId>
    <version>6.0.10</version>
</dependency>
```

---

## Step 4: Add the Parent POM (Optional)

If you are building an OpenFrame-compatible service, inherit from the parent POM to get aligned dependency management:

```xml
<parent>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-oss-lib</artifactId>
    <version>6.0.10</version>
</parent>
```

This gives you pre-configured:
- Spring Boot 3.3.0
- Java 21
- Lombok 1.18.30
- Spring Cloud 2023.0.3
- NATS, Kafka, MongoDB, Pinot, gRPC versions

---

## Step 5: Run a Single Module Test

```bash
# Run unit tests for the exception module
mvn test -pl openframe-exception

# Run integration tests for MongoDB sync module (requires Docker)
mvn verify -pl openframe-data-mongo-sync
```

---

## Hello World: Using Core Utilities

Here is a minimal example using the shared utilities from `openframe-core`:

```java
import com.openframe.core.util.SlugUtil;
import com.openframe.core.service.AgentRegistrationSecretGenerator;

// Generate a URL-safe slug
String slug = SlugUtil.toSlug("My MSP Organization");
// Result: "my-msp-organization"

// The AgentRegistrationSecretGenerator produces secure tokens
// for device registration flows
```

---

## Expected Results

After a successful build, you should see:

```text
[INFO] ------------------------------------------------------------------------
[INFO] Reactor Summary for OpenFrame OSS Libraries 6.0.10:
[INFO]
[INFO] OpenFrame OSS Libraries ........................ SUCCESS
[INFO] openframe-exception ............................ SUCCESS
[INFO] openframe-core ................................ SUCCESS
[INFO] openframe-core-crypto ......................... SUCCESS
[INFO] openframe-data-mongo-common ................... SUCCESS
[INFO] openframe-data-mongo-sync ..................... SUCCESS
[INFO] openframe-data-mongo-reactive ................. SUCCESS
[INFO] ...
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

---

## Quick Module Reference

| Module | Artifact ID | Use Case |
|--------|------------|----------|
| Core utilities | `openframe-core` | Slugs, pagination, validation |
| Exception handling | `openframe-exception` | Unified error responses |
| Encryption | `openframe-core-crypto` | AES encryption services |
| MongoDB common | `openframe-data-mongo-common` | Document models |
| MongoDB sync | `openframe-data-mongo-sync` | Synchronous repositories |
| MongoDB reactive | `openframe-data-mongo-reactive` | Reactive repositories |
| Redis | `openframe-data-redis` | Caching, rate limits |
| Kafka | `openframe-data-kafka` | Event producers |
| API contracts | `openframe-api-lib` | Shared DTOs and filters |
| Security core | `openframe-security-core` | JWT, auth principals |

---

## Consuming from GitHub Packages

If you prefer consuming published artifacts rather than building locally, add the GitHub Packages repository to your `pom.xml`:

```xml
<repositories>
    <repository>
        <id>github</id>
        <url>https://maven.pkg.github.com/flamingo-stack/openframe-oss-lib</url>
    </repository>
</repositories>
```

Ensure your `~/.m2/settings.xml` has a `server` entry with `id=github` and a valid GitHub token as described in the [Prerequisites](prerequisites.md).

---

## Next Steps

After your quick start:

- Follow the [First Steps Guide](first-steps.md) to explore key features and modules
- Review the [Prerequisites](prerequisites.md) for full environment configuration
- Explore the [Architecture Overview](../development/architecture/README.md) to understand how modules fit together
