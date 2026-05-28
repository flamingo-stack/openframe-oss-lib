# Development Documentation

Welcome to the **openframe-oss-lib** development documentation. This section covers everything you need to contribute to, extend, and maintain the OpenFrame OSS library.

---

## Overview

**openframe-oss-lib** is a Java 21 / Spring Boot 3.3 multi-module Maven library. It is the shared backend infrastructure stack for the OpenFrame MSP platform. The development section explains how to set up your environment, understand the architecture, write tests, secure your code, and contribute effectively.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Environment Setup](./setup/environment.md) | IDE configuration, extensions, and dev tools |
| [Local Development](./setup/local-development.md) | Clone, build, run, and debug locally |
| [Architecture Overview](./architecture/README.md) | System design, module relationships, data flows |
| [Security Best Practices](./security/README.md) | Auth patterns, secrets management, input validation |
| [Testing Overview](./testing/README.md) | Test structure, running tests, writing new tests |
| [Contributing Guidelines](./contributing/guidelines.md) | Code style, PR process, commit conventions |

---

## Quick Navigation

### I want to...

**Set up my local environment**
→ Start with [Environment Setup](./setup/environment.md), then [Local Development](./setup/local-development.md)

**Understand how the system works**
→ Read the [Architecture Overview](./architecture/README.md)

**Add a new feature or fix a bug**
→ Follow the [Contributing Guidelines](./contributing/guidelines.md) and review [Local Development](./setup/local-development.md)

**Write tests for my changes**
→ See [Testing Overview](./testing/README.md)

**Understand security requirements**
→ Read [Security Best Practices](./security/README.md)

---

## Tech Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Language | Java 21 |
| Framework | Spring Boot 3.3 |
| Build Tool | Apache Maven 3.9+ |
| Multi-tenancy | Thread-local tenant context, per-tenant RSA keys |
| Auth | Spring Authorization Server, Spring Security OAuth2 |
| Persistence | MongoDB (sync + reactive), Redis, Cassandra, Apache Pinot |
| Messaging | Kafka / Debezium CDC, NATS JetStream |
| Gateway | Spring Cloud Gateway + WebFlux + Netty |
| API | Relay-compliant GraphQL (Netflix DGS), REST |
| Testing | JUnit 5, Testcontainers, RestAssured |
| Distributed Locking | ShedLock + Redis |

---

## Repository Structure

```text
openframe-oss-lib/
├── pom.xml                              # Parent POM (unified versioning)
├── openframe-core/                      # Core utilities
├── openframe-exception/                 # Exception hierarchy
├── openframe-core-crypto/               # Encryption
├── openframe-security-core/             # JWT, PKCE, cookies
├── openframe-security-oauth/            # OAuth2 BFF
├── openframe-authorization-service-core/# Multi-tenant auth server
├── openframe-api-lib/                   # API contracts, DTOs
├── openframe-api-service-core/          # REST + GraphQL API
├── openframe-gateway-service-core/      # Reactive gateway
├── openframe-client-core/               # Agent/client endpoints
├── openframe-data-mongo-common/         # MongoDB documents
├── openframe-data-mongo-sync/           # Sync repositories
├── openframe-data-mongo-reactive/       # Reactive repositories
├── openframe-data-redis/                # Redis cache
├── openframe-data-kafka/                # Kafka configuration
├── openframe-data-nats/                 # NATS messaging
├── openframe-data-cassandra/            # Cassandra storage
├── openframe-data-pinot/                # Pinot analytics
├── openframe-management-service-core/   # Schedulers, initializers
├── openframe-stream-service-core/       # Kafka streams
├── openframe-external-api-service-core/ # External REST API
├── openframe-test-service-core/         # Integration test utilities
├── sdk/
│   ├── fleetmdm/                        # Fleet MDM SDK
│   └── tacticalrmm/                     # Tactical RMM SDK
└── ...
```

---

## Community

All development discussions happen in the [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA). We do not use GitHub Issues or GitHub Discussions.

[![OpenFrame v0.5.2: Autonomous AI Agent Architecture for MSPs](https://img.youtube.com/vi/PexpoNdZtUk/maxresdefault.jpg)](https://www.youtube.com/watch?v=PexpoNdZtUk)
