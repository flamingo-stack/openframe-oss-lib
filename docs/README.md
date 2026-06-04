# openframe-oss-lib Documentation

Welcome to the documentation hub for **`openframe-oss-lib`** — the modular backend foundation of the [OpenFrame platform](https://openframe.ai) by [Flamingo](https://flamingo.run).

---

## 📚 Table of Contents

- [Getting Started](#getting-started)
- [Development](#development)
- [Reference Architecture](#reference-architecture)
- [Architecture Diagrams](#architecture-diagrams)
- [Quick Links](#quick-links)

---

## Getting Started

New to `openframe-oss-lib`? Start here.

| Document | Description |
|----------|-------------|
| [Introduction](./getting-started/introduction.md) | What is openframe-oss-lib, key features, and architecture overview |
| [Prerequisites](./getting-started/prerequisites.md) | Required tools, infrastructure dependencies, and environment setup |
| [Quick Start](./getting-started/quick-start.md) | Clone, configure, and build in under 5 minutes |
| [First Steps](./getting-started/first-steps.md) | Explore key modules, set up local infrastructure, and write your first extension |

---

## Development

Guides for building, testing, and contributing to the library.

| Document | Description |
|----------|-------------|
| [Development Overview](./development/README.md) | Technology stack, repository structure, and module dependency layers |
| [Environment Setup](./development/setup/environment.md) | IDE configuration, toolchain installation, and recommended plugins |
| [Local Development](./development/setup/local-development.md) | Build workflow, local infrastructure, hot reload tips, and debugging |
| [Testing Guide](./development/testing/README.md) | Unit tests, integration tests, Testcontainers patterns, and E2E framework |
| [Security Guide](./development/security/README.md) | JWT architecture, OAuth2/PKCE flows, RBAC, secrets management |
| [Architecture Overview](./development/architecture/README.md) | High-level component interactions and key design decisions |
| [Contributing Guidelines](./development/contributing/guidelines.md) | Code style, branch naming, commit conventions, and PR process |

---

## Reference Architecture

Detailed technical documentation for every major module, generated from source code analysis.

### API Layer

| Document | Description |
|----------|-------------|
| [API Lib — DTO Contracts](./reference/architecture/api-lib-dto-contracts/api-lib-dto-contracts.md) | Stable transport contracts shared between REST, GraphQL, and services |
| [API Lib — Mapping & Domain Services](./reference/architecture/api-lib-mapping-and-domain-services/api-lib-mapping-and-domain-services.md) | Mapping layer between DTOs, domain documents, and repositories |
| [API Service Core — REST Controllers](./reference/architecture/api-service-core-rest-controllers/api-service-core-rest-controllers.md) | Thin HTTP controllers for organizations, devices, API keys, users |
| [API Service Core — GraphQL Layer](./reference/architecture/api-service-core-graphql-layer/api-service-core-graphql-layer.md) | Relay-compliant GraphQL with cursor pagination and mutations |
| [API Service Core — GraphQL DataLoaders](./reference/architecture/api-service-core-graphql-dataloaders/api-service-core-graphql-dataloaders.md) | Batched DataLoaders preventing N+1 queries |
| [API Service Core — DTOs](./reference/architecture/api-service-core-dtos/api-service-core-dtos.md) | REST and GraphQL DTOs for SSO, OAuth, invitations, and notifications |
| [API Service Core — Business Services](./reference/architecture/api-service-core-business-services/api-service-core-business-services.md) | Core domain orchestration: users, SSO, domains, extension processors |
| [API Service Core — Config & Security](./reference/architecture/api-service-core-config-and-security/api-service-core-config-and-security.md) | JWT resource server, OAuth integration, custom GraphQL scalars |

### Security & Authorization

| Document | Description |
|----------|-------------|
| [Authorization Service Core](./reference/architecture/authorization-service-core/authorization-service-core.md) | Full OAuth2/OIDC server: multi-tenant JWT issuers, PKCE, SSO providers |
| [Security — OAuth & JWT](./reference/architecture/security-oauth-and-jwt/security-oauth-and-jwt.md) | JWT encoder/decoder, PKCE utilities, OAuth BFF controller |

### Gateway

| Document | Description |
|----------|-------------|
| [Gateway Service Core](./reference/architecture/gateway-service-core/gateway-service-core.md) | Reactive Spring Cloud Gateway: JWT validation, API key auth, WebSocket proxy |

### Persistence

| Document | Description |
|----------|-------------|
| [Data Model & Repositories (Mongo)](./reference/architecture/data-model-and-repositories-mongo/data-model-and-repositories-mongo.md) | MongoDB documents, query filters, base repositories, tenant ID provider |
| [Data Access — Mongo Sync](./reference/architecture/data-access-mongo-sync/data-access-mongo-sync.md) | MongoTemplate-based repositories: pagination, aggregations, optimistic locking |

### Messaging & Events

| Document | Description |
|----------|-------------|
| [Eventing & Messaging — Kafka & NATS](./reference/architecture/eventing-and-messaging-kafka-nats/eventing-and-messaging-kafka-nats.md) | Hybrid messaging: Kafka durable streaming, NATS real-time, Debezium CDC |

### Stream Processing & Analytics

| Document | Description |
|----------|-------------|
| [Stream Processing Core](./reference/architecture/stream-processing-core/stream-processing-core.md) | Real-time event enrichment: Kafka Streams, Pinot ingestion, unified taxonomy |
| [Analytics — Pinot](./reference/architecture/analytics-pinot/analytics-pinot.md) | High-performance read layer: device filtering, log search, cursor pagination |

### Agent & Management

| Document | Description |
|----------|-------------|
| [Client Core — Agent Ingress](./reference/architecture/client-core-agent-ingress/client-core-agent-ingress.md) | Agent registration, OAuth token issuance, heartbeat, JetStream listeners |
| [Management Service Core](./reference/architecture/management-service-core/management-service-core.md) | NATS stream init, tool lifecycle, schedulers, Mongock migrations |

### Integrations

| Document | Description |
|----------|-------------|
| [Integrations SDKs](./reference/architecture/integrations-sdks/integrations-sdks.md) | Typed SDK abstractions for Tactical RMM and Fleet MDM |

### External API

| Document | Description |
|----------|-------------|
| [External API Service Core](./reference/architecture/external-api-service-core/external-api-service-core.md) | OpenAPI-documented REST API for third-party consumers |

---

## Architecture Diagrams

Visual documentation is available as Mermaid diagram files in:

```text
docs/diagrams/architecture/
```

Key diagrams include:
- `README.mmd` — Full end-to-end system overview
- `gateway-service-core.mmd` — Gateway routing and authentication flow
- `authorization-service-core.mmd` — OAuth2/OIDC authorization flows
- `stream-processing-core.mmd` — Kafka Streams event enrichment pipeline
- `security-oauth-and-jwt.mmd` — JWT multi-issuer validation flow
- `data-access-mongo-sync.mmd` — Repository patterns and cursor pagination
- `client-core-agent-ingress.mmd` — Agent registration and command dispatch
- `management-service-core.mmd` — Bootstrapping and scheduler lifecycle

---

## 📖 Quick Links

- [Project README](../README.md) — Main project overview and quick start
- [Contributing Guidelines](../CONTRIBUTING.md) — How to contribute
- [OpenMSP Community](https://www.openmsp.ai/) — Slack community for support and discussions
- [Flamingo Platform](https://flamingo.run) — The commercial platform built on OpenFrame
- [OpenFrame](https://openframe.ai) — Unified AI-driven MSP platform

---

> 💬 **Need help?** Join the [OpenMSP Slack community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) — all discussions and support happen there.

---

*Documentation generated by [OpenFrame Doc Orchestrator](https://github.com/flamingo-stack/openframe-oss-tenant)*
