# Prerequisites

Before working with `openframe-oss-lib`, ensure your development environment meets the following requirements.

---

## Required Software

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| **Java (JDK)** | 21 | The project requires Java 21 (LTS). Use OpenJDK or Eclipse Temurin. |
| **Apache Maven** | 3.9+ | Used for building all modules. Maven wrapper (`mvnw`) is preferred. |
| **Git** | 2.x | For cloning and version control. |
| **Node.js** | 18+ | Required for documentation tooling and the `openframe-frontend-core` module. |
| **Docker** | 24+ | Required to run integration test infrastructure (MongoDB, NATS, Redis, Kafka). |
| **Docker Compose** | 2.x | Used for spinning up integration test environments. |

---

## Infrastructure Dependencies

The OpenFrame platform integrates with several external services. Depending on the modules you work with, you may need access to:

| Service | Purpose | Required For |
|---------|---------|-------------|
| **MongoDB** | Primary operational database | All modules |
| **Redis** | Caching, rate limiting, distributed locking | Gateway, Management, Data-Redis modules |
| **Apache Kafka** | Durable event streaming | Stream service, Data-Kafka modules |
| **NATS** | Real-time agent messaging | Client core, Data-NATS modules |
| **Apache Pinot** | Time-series analytics | Stream, Pinot, Data-Pinot modules |
| **Kafka Connect / Debezium** | Change Data Capture from MongoDB | Debezium initializer module |

> For integration tests, a Docker Compose configuration is provided in `openframe-data-mongo-sync/src/test/docker/` to start a local MongoDB instance.

---

## GitHub Access

### GitHub Packages (Maven Registry)

The modules are published to the GitHub Packages Maven registry. You will need:

1. A GitHub account with access to the `flamingo-stack` organization
2. A **GitHub Personal Access Token (PAT)** with `read:packages` scope

Configure your `~/.m2/settings.xml` to authenticate:

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

---

## Java Version Verification

```bash
java -version
# Expected output:
# openjdk version "21.x.x" ...

mvn -version
# Expected output:
# Apache Maven 3.x.x ...
```

---

## Environment Variables

Some modules require environment variables to be configured. The following are commonly used:

| Variable | Description | Example |
|----------|-------------|---------|
| `TENANT_ID` | Default tenant identifier for OSS deployments | `oss` |
| `SPRING_DATA_MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/openframe` |
| `SPRING_REDIS_HOST` | Redis host | `localhost` |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | Kafka broker address | `localhost:9092` |
| `NATS_SERVER` | NATS server URL | `nats://localhost:4222` |
| `jwt.public-key` | RSA public key (PEM, base64 encoded) | Refer to your environment configuration |
| `jwt.private-key` | RSA private key (PEM, base64 encoded) | Refer to your environment configuration |
| `oauth.client.default.id` | Default OAuth client ID | Refer to your environment configuration |
| `oauth.client.default.secret` | Default OAuth client secret | Refer to your environment configuration |

> **Security note**: Never commit secrets or private keys to version control. Use environment-specific configuration management or a secrets manager.

---

## IDE Recommendations

| IDE | Notes |
|-----|-------|
| **IntelliJ IDEA** | Recommended. Excellent Lombok and Spring Boot support. Use the Community or Ultimate edition. |
| **VS Code** | Works well with the Java Extension Pack and Spring Boot Extension Pack. |
| **Eclipse** | Supported but requires manual Lombok and annotation processor configuration. |

### IntelliJ IDEA Setup

1. Open the root `pom.xml` as a Maven project
2. Enable annotation processing: `Settings → Build → Compiler → Annotation Processors → Enable`
3. Install the Lombok plugin if not already present
4. Set the project SDK to Java 21

---

## Lombok Configuration

This project uses [Project Lombok](https://projectlombok.org/) for boilerplate reduction. Ensure:

- The Lombok JAR is available in your Maven local repository (it's declared as a dependency in the parent POM)
- Your IDE has the Lombok plugin or annotation processing enabled

---

## Checking Readiness

Run the following commands to confirm your environment is ready:

```bash
# 1. Verify Java 21
java -version

# 2. Verify Maven
mvn -version

# 3. Verify Docker is running
docker info

# 4. Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# 5. Attempt to compile (skipping tests initially)
mvn compile -DskipTests
```

A successful compile without errors indicates your environment is configured correctly.

---

## Need Help?

> Join the **OpenMSP Slack community** to ask questions and get support from the community and maintainers.
> 
> 👉 [https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
