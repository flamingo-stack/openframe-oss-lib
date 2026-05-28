# Prerequisites

Before working with **openframe-oss-lib**, ensure your development environment meets all requirements below.

---

## Required Software

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Java (JDK) | 21 | Required by all modules (Spring Boot 3.3 baseline) |
| Apache Maven | 3.9+ | Build and dependency management |
| Git | 2.x | Source code management |
| Docker | 24.x | Running integration test containers |
| Node.js | 20+ | Required for the documentation tooling (`package.json` present) |

---

## Java Version

This library targets **Java 21** (LTS). Ensure your `JAVA_HOME` points to a Java 21 JDK:

```bash
java -version
# Should output: openjdk 21.x.x ...
```

Recommended distributions:

- [Eclipse Temurin 21](https://adoptium.net/)
- [Amazon Corretto 21](https://aws.amazon.com/corretto/)
- [GraalVM 21](https://www.graalvm.org/)

---

## Maven

Maven 3.9 or higher is required:

```bash
mvn -version
# Apache Maven 3.9.x ...
```

The project uses the `flatten-maven-plugin` for CI-friendly versioning (`${revision}`), so Maven 3.9+ is required for proper resolution.

---

## GitHub Packages Access

The library is published to **GitHub Maven Packages**. To consume it as a dependency in downstream services you need a GitHub Personal Access Token (PAT) with `read:packages` permission.

Add to `~/.m2/settings.xml`:

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

> Your `GITHUB_PAT` must have the `read:packages` scope to resolve dependencies, and `write:packages` to publish new versions.

---

## Infrastructure Services (for Integration Tests)

Some modules run integration tests against live services via Testcontainers. Ensure Docker is running and the following images can be pulled:

| Service | Used By |
|---------|---------|
| MongoDB | `openframe-data-mongo-sync`, `openframe-api-service-core` integration tests |
| NATS | `openframe-data-nats` integration tests |

Testcontainers will automatically spin up and tear down containers during integration test execution. The only requirement is a running Docker daemon.

```bash
docker info
# Should not return an error
```

---

## Environment Variables

The following environment variables may be needed depending on which modules you are developing:

| Variable | Required For | Description |
|----------|-------------|-------------|
| `GITHUB_ACTOR` | Publishing | GitHub username for package publishing |
| `GITHUB_TOKEN` | Publishing | GitHub PAT for package publishing |

For local development without publishing, only local Maven settings are needed.

---

## Recommended IDE

| IDE | Notes |
|-----|-------|
| IntelliJ IDEA (Ultimate or Community) | Best support for Spring Boot, Maven multi-module, Lombok |
| VS Code + Java Extension Pack | Alternative for lighter setup |

### IntelliJ Setup Checklist

1. Import as **Maven project** (not Gradle)
2. Set **Project SDK** to Java 21
3. Enable **Annotation Processors** for Lombok support
4. Set Maven delegate: `Settings → Build Tools → Maven → Runner → Delegate IDE build/run actions to Maven`

---

## Verification Commands

Run these checks before beginning development:

```bash
# Verify Java version
java -version

# Verify Maven version
mvn -version

# Verify Docker is running
docker info

# Verify Git configuration
git config user.name
git config user.email

# Verify GitHub Packages access (requires settings.xml configured)
mvn dependency:resolve -pl openframe-core -q
```

---

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| Disk | 5 GB free | 20 GB free |
| CPU | 4 cores | 8+ cores |
| OS | macOS, Linux, Windows (WSL2) | macOS or Linux |

> Building the entire repository (`mvn install`) compiles 30+ modules. Sufficient RAM (especially heap) prevents OOM during compilation.

To increase Maven heap:

```bash
export MAVEN_OPTS="-Xmx4g -XX:MaxMetaspaceSize=512m"
```

---

## Community & Support

If you run into setup issues, reach out on the [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA).
