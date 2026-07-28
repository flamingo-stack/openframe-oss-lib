# Prerequisites

Before working with **OpenFrame OSS Lib**, ensure your development environment meets the requirements below. This library is a multi-language monorepo containing Java/Spring Boot modules, a Rust agent client, and a TypeScript/React frontend library.

---

## Required Software

| Tool | Minimum Version | Purpose |
|---|---|---|
| **JDK** | 21 | Java backend modules (Spring Boot 3.3) |
| **Maven** | 3.9+ | Build and dependency management |
| **Node.js** | 18+ | Frontend (`openframe-frontend-core`) |
| **npm / pnpm** | npm 9+ | Frontend package management |
| **Rust** | Stable (latest) | `clients/openframe-client` (Rust agent) |
| **cargo** | Bundled with Rust | Rust build tool |
| **Git** | 2.x+ | Source control |
| **Docker** | 24+ | Running test infrastructure (MongoDB, NATS) |
| **Docker Compose** | 2.x+ | Test environment orchestration |

---

## System Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| **RAM** | 8 GB | 16 GB+ |
| **CPU** | 4 cores | 8 cores |
| **Disk** | 10 GB free | 20 GB free |
| **OS** | Linux, macOS, Windows (WSL2) | Linux or macOS |

> **Note on Windows:** WSL2 (Windows Subsystem for Linux 2) is strongly recommended for the Rust agent client. Native Windows builds are supported but require additional setup.

---

## Java & Build Requirements

The backend modules require **Java 21**. The parent POM enforces this via:

```xml
<java.version>21</java.version>
```

Key Spring ecosystem versions managed by the parent POM:

| Dependency | Version |
|---|---|
| Spring Boot | 3.3.0 |
| Spring Cloud | 2023.0.3 |
| Spring Authorization Server | 1.3.1 |
| Netflix DGS | 9.0.3 |
| Lombok | 1.18.30 |
| Testcontainers | 1.21.4 |

---

## Verify Java Setup

```bash
java -version
# Expected: openjdk version "21.x.x" or similar

mvn -version
# Expected: Apache Maven 3.9.x
```

---

## Node.js Setup (Frontend)

The `openframe-frontend-core` module is a React/TypeScript component library. It requires Node.js 18 or higher.

```bash
node --version
# Expected: v18.x.x or v20.x.x

npm --version
# Expected: 9.x.x or later
```

---

## Rust Setup (Agent Client)

The `clients/openframe-client` is written in Rust. Install Rust using `rustup`:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Follow the prompts to complete installation

rustc --version
# Expected: rustc 1.7x.x (stable)

cargo --version
# Expected: cargo 1.7x.x (stable)
```

---

## Docker Requirements

Several test suites use Testcontainers to spin up MongoDB, NATS, and Redis instances. Docker must be running and accessible:

```bash
docker --version
# Expected: Docker version 24.x.x or later

docker compose version
# Expected: Docker Compose version v2.x.x
```

> A Docker Compose file for MongoDB integration tests is available at:
> `openframe-data-mongo-sync/src/test/docker/docker-compose.yml`

---

## GitHub Package Registry Access

The library publishes to GitHub Packages (`https://maven.pkg.github.com/flamingo-stack/openframe-oss-lib`). To consume published artifacts, configure your Maven `~/.m2/settings.xml`:

```xml
<servers>
  <server>
    <id>github</id>
    <username>YOUR_GITHUB_USERNAME</username>
    <password>YOUR_GITHUB_TOKEN</password>
  </server>
</servers>
```

> Replace `YOUR_GITHUB_TOKEN` with a GitHub Personal Access Token that has the `read:packages` scope.

---

## Environment Variables

Some modules or test suites may require environment variables. Refer to your environment configuration and any `.env.example` files in the project. Common variables include:

| Variable | Used By | Description |
|---|---|---|
| `GITHUB_TOKEN` | Maven | GitHub Packages authentication |
| `GITHUB_USERNAME` | Maven | GitHub Packages username |

For service-level environment variables (MongoDB URIs, NATS endpoints, etc.), refer to the `openframe-oss-tenant` platform documentation at [https://github.com/flamingo-stack/openframe-oss-tenant](https://github.com/flamingo-stack/openframe-oss-tenant).

---

## IDE Recommendations

| IDE | Notes |
|---|---|
| **IntelliJ IDEA** (Ultimate or Community) | Best Java/Kotlin + Maven support; Lombok plugin required |
| **VS Code** | Good for frontend (TypeScript/React) and Rust with `rust-analyzer` |
| **Eclipse** | Supported but IntelliJ is preferred |

For IntelliJ:
- Install the **Lombok** plugin (File → Settings → Plugins → Lombok)
- Enable annotation processing (Build, Execution, Deployment → Compiler → Annotation Processors)

---

## Verification Checklist

Run these commands to confirm your environment is ready:

```bash
# Java
java -version

# Maven
mvn -version

# Node.js
node --version

# Rust
rustc --version

# Docker
docker info

# Git
git --version
```

All commands should return valid version strings without errors before proceeding.

---

## Next Steps

Once your environment is set up, continue to the [Quick Start Guide](quick-start.md) to build and explore the library.
