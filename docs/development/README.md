# Development Documentation

Welcome to the **OpenFrame OSS Lib** development documentation. This section covers everything needed to develop, extend, test, and contribute to the library.

---

## Overview

OpenFrame OSS Lib is a multi-language monorepo:

- **Java/Spring Boot** — The primary backend module system (Maven multi-module)
- **TypeScript/React** — Frontend component library (`openframe-frontend-core`)
- **Rust** — Cross-platform device agent client (`clients/openframe-client`)

---

## Documentation Map

| Guide | Description |
|---|---|
| [Environment Setup](setup/environment.md) | IDE configuration, required plugins, editor extensions |
| [Local Development](setup/local-development.md) | Clone, build, run, debug |
| [Architecture Overview](architecture/README.md) | System design, component diagrams, data flow |
| [Security Best Practices](security/README.md) | Auth patterns, secrets management, vulnerability mitigations |
| [Testing Overview](testing/README.md) | Test structure, running tests, coverage requirements |
| [Contributing Guidelines](contributing/guidelines.md) | Code style, branch naming, PR process, commit format |

---

## Quick Reference

### Build All Modules

```bash
mvn clean install -DskipTests
```

### Run Tests for a Module

```bash
mvn test -pl openframe-api-service-core
```

### Build Frontend

```bash
cd openframe-frontend-core && npm install && npm run build
```

### Build Rust Agent

```bash
cd clients/openframe-client && cargo build --release
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Java framework | Spring Boot 3.3, Spring Cloud 2023 |
| Authorization | Spring Authorization Server 1.3.1 |
| API (GraphQL) | Netflix DGS 9.0.3 |
| Gateway | Spring Cloud Gateway (WebFlux + Netty) |
| Messaging | NATS, Kafka, Kafka Streams |
| Database | MongoDB, Redis, Apache Cassandra, Apache Pinot |
| Testing | JUnit 5, Testcontainers 1.21.4, Mockito |
| Frontend | React, TypeScript, Tailwind CSS, Storybook |
| Agent | Rust (stable), Tokio async runtime |
| Build | Maven 3.9+, Node.js 18+, Cargo |

---

## Repository at a Glance

```text
openframe-oss-lib/
├── openframe-*/                  ← Java Spring Boot library modules
├── sdk/fleetmdm/                 ← Fleet MDM Java SDK
├── clients/openframe-client/     ← Rust cross-platform agent
├── openframe-frontend-core/      ← React/TypeScript UI library
├── react-embedding-example/      ← Embedding example app
├── pom.xml                       ← Maven parent POM
└── package.json                  ← Node.js/AI tooling scripts
```

---

## Getting Started

If you haven't already, follow the [Getting Started](../getting-started/introduction.md) guides to set up your environment and complete the initial build before diving into development.
