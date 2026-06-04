# Prerequisites

Before working with `openframe-oss-lib`, ensure your development environment meets the following requirements.

---

## Required Software

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| **Java (JDK)** | 21 | Project uses Java 21 features; LTS recommended |
| **Apache Maven** | 3.8+ | Used for building all modules |
| **Git** | 2.x+ | For cloning the repository |
| **Docker** | 24.x+ | Required for integration tests (Testcontainers) |
| **Docker Compose** | 2.x+ | Available for local infrastructure setup |
| **Node.js** | 18+ | Required for frontend-core module development |

> **Note:** The project uses the `flatten-maven-plugin` with CI-friendly versioning. Maven Wrapper (`./mvnw`) is recommended if available.

---

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **RAM** | 8 GB | 16 GB+ |
| **CPU Cores** | 4 | 8+ |
| **Disk Space** | 10 GB free | 20 GB free |
| **OS** | Linux / macOS / Windows (WSL2) | Linux / macOS |

> Integration tests use **Testcontainers** to spin up MongoDB and other services in Docker. Docker must be accessible to the running JVM process.

---

## Infrastructure Dependencies

When running services locally, the following infrastructure components are required:

| Service | Version | Purpose |
|---------|---------|---------|
| **MongoDB** | 6.x+ | Primary data store for all domain documents |
| **Redis** | 7.x+ | Caching, rate limiting, and distributed locks (ShedLock) |
| **Apache Kafka** | 3.x+ | Event streaming and CDC processing |
| **NATS** | 2.x+ | Agent messaging and real-time notifications |
| **Apache Cassandra** | 4.x+ | Long-term unified event log storage |
| **Apache Pinot** | 1.2.0 | Analytics query engine |

> For unit and module-level tests, these are not required — Testcontainers handles in-process infrastructure.

---

## GitHub Package Registry Access

The library publishes artifacts to **GitHub Maven Package Registry**. To consume modules as Maven dependencies, configure your `~/.m2/settings.xml`:

```xml
<settings>
  <servers>
    <server>
      <id>github</id>
      <username>YOUR_GITHUB_USERNAME</username>
      <password>YOUR_GITHUB_TOKEN</password>
    </server>
  </servers>
</settings>
```

Generate a GitHub Personal Access Token (PAT) with `read:packages` scope from [GitHub Settings → Developer Settings](https://github.com/settings/tokens).

---

## Key Environment Variables

The following environment variables are used across modules:

| Variable | Module | Description |
|----------|--------|-------------|
| `TENANT_ID` | `openframe-data-mongo-common` | Tenant ID for multi-tenant scoping (defaults to `oss`) |
| `SPRING_DATA_MONGODB_URI` | All data modules | MongoDB connection string |
| `SPRING_REDIS_HOST` | `openframe-data-redis` | Redis host |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `openframe-data-kafka` | Kafka broker addresses |
| `NATS_SERVER_URL` | `openframe-data-nats` | NATS server URL |

> In OSS single-tenant mode, `TENANT_ID` defaults to `oss` if not set.

---

## Verification Commands

Run these commands to verify your environment is ready:

```bash
# Verify Java version (must be 21+)
java -version

# Verify Maven is available
mvn -version

# Verify Docker is running
docker info

# Verify Docker Compose
docker compose version

# Verify Git
git --version

# Verify Node.js (for frontend-core work)
node --version
npm --version
```

Expected Java output:
```text
openjdk version "21.x.x" ...
```

---

## IDE Recommendations

| IDE | Recommended Plugins |
|-----|---------------------|
| **IntelliJ IDEA** (recommended) | Lombok, Spring Boot, GraphQL |
| **VS Code** | Extension Pack for Java, Spring Boot Tools |
| **Eclipse** | Spring Tools Suite 4 |

> Enable annotation processing in your IDE to support **Lombok** (`@Data`, `@Builder`, `@Slf4j`, etc.), which is used extensively across all modules.

---

## Maven Settings for Building

To build the full project locally, ensure access to the GitHub Maven Package Registry as described above, then verify your local Maven cache:

```bash
# Verify Maven can resolve dependencies
mvn dependency:resolve -pl openframe-core --quiet
```

If dependency resolution fails, check your GitHub token permissions and `settings.xml` configuration.
