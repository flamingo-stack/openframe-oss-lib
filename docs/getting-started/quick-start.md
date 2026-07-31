# Quick Start

Get **OpenFrame OSS Lib** cloned, built, and available in your local Maven repository in under 5 minutes.

---

## TL;DR — 5-Minute Setup

```bash
# 1. Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# 2. Build all modules (skip tests for speed)
mvn clean install -DskipTests

# 3. Verify the build succeeded
mvn dependency:resolve -DincludeArtifactIds=openframe-core
```

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib
```

Expected structure at the repository root:

```text
openframe-oss-lib/
├── pom.xml                          ← Parent POM (openframe-oss-lib)
├── openframe-core/
├── openframe-api-service-core/
├── openframe-gateway-service-core/
├── openframe-authorization-service-core/
├── openframe-data-mongo-common/
├── openframe-data-mongo-sync/
├── openframe-stream-service-core/
├── clients/openframe-client/        ← Rust agent
├── openframe-frontend-core/         ← React/TS UI library
└── ...
```

---

## Step 2: Build the Java Modules

The parent POM uses **Maven Flatten Plugin** for CI-friendly versioning (`${revision}`). The default version is `999-SNAPSHOT`.

```bash
# Full build (skip tests for speed)
mvn clean install -DskipTests
```

To build with tests (requires Docker for Testcontainers):

```bash
mvn clean install
```

Expected output on success:

```text
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  2:34 min
[INFO] Finished at: ...
[INFO] ------------------------------------------------------------------------
```

---

## Step 3: Use a Module in Your Project

After installing locally, add a dependency to your Spring Boot service's `pom.xml`. For example, to use the core data layer:

```xml
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-data-mongo-sync</artifactId>
    <version>999-SNAPSHOT</version>
</dependency>
```

Or to use the API service infrastructure:

```xml
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-api-service-core</artifactId>
    <version>999-SNAPSHOT</version>
</dependency>
```

Or to use the gateway module:

```xml
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-gateway-service-core</artifactId>
    <version>999-SNAPSHOT</version>
</dependency>
```

---

## Step 4: Build the Frontend Library (Optional)

The `openframe-frontend-core` module is a React/TypeScript UI component library.

```bash
cd openframe-frontend-core

# Install dependencies
npm install

# Build the library
npm run build
```

---

## Step 5: Build the Rust Agent Client (Optional)

The `clients/openframe-client` is the Rust-based device agent.

```bash
cd clients/openframe-client

# Build in release mode
cargo build --release

# The binary will be at:
# target/release/openframe-client
```

---

## Available Maven Modules

After running `mvn clean install`, all modules are available in your local Maven repository (`~/.m2/repository/com/openframe/oss/`):

| Artifact ID | Purpose |
|---|---|
| `openframe-exception` | Exception hierarchy |
| `openframe-core` | Core utilities (validation, pagination) |
| `openframe-core-crypto` | Encryption service |
| `openframe-security-core` | JWT and auth context helpers |
| `openframe-security-oauth` | OAuth BFF service |
| `openframe-authorization-service-core` | OAuth2/OIDC authorization server |
| `openframe-gateway-service-core` | Reactive API gateway |
| `openframe-api-service-core` | Internal GraphQL + REST API |
| `openframe-api-lib` | API contracts and DTOs |
| `openframe-external-api-service-core` | External REST API |
| `openframe-client-core` | Agent lifecycle service |
| `openframe-data-mongo-common` | MongoDB domain documents |
| `openframe-data-mongo-sync` | Synchronous MongoDB repositories |
| `openframe-data-mongo-reactive` | Reactive MongoDB repositories |
| `openframe-data-redis` | Redis caching |
| `openframe-data-kafka` | Kafka producers |
| `openframe-data-nats` | NATS messaging |
| `openframe-stream-service-core` | Kafka Streams processing |
| `openframe-management-service-core` | Platform management |
| `openframe-notification-mail` | Email notifications |
| `openframe-notification-push` | FCM push notifications |
| `fleetmdm` | Fleet MDM SDK |

---

## Building a Specific Module Only

To build a single module without building the entire project:

```bash
mvn clean install -pl openframe-data-mongo-common -am -DskipTests
```

The `-am` flag builds all modules the specified module depends on.

---

## Expected Results

After a successful build:

- All `.jar` artifacts are installed in your local Maven cache (`~/.m2`)
- Each module produces a `-sources.jar` alongside the main artifact
- The `flatten-maven-plugin` resolves `${revision}` in published POMs

---

## Next Steps

- Read the [First Steps Guide](first-steps.md) to understand the module structure and key patterns
- Explore the [Architecture Overview](../development/architecture/README.md) for deeper understanding
- Visit the [OpenFrame OSS Tenant](https://github.com/flamingo-stack/openframe-oss-tenant) to see how these modules are assembled into a running platform
