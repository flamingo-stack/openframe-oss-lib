# OpenFrame OSS Lib — Documentation

Welcome to the `openframe-oss-lib` documentation. This is the modular backbone of [OpenFrame](https://openframe.ai) — Flamingo's AI-powered MSP platform.

> 📣 All discussions, questions, and feature requests are managed on [OpenMSP Slack](https://www.openmsp.ai/). We do **not** use GitHub Issues or GitHub Discussions.

---

## 📚 Table of Contents

- [Getting Started](#-getting-started)
- [Development](#-development)
- [Reference Architecture](#-reference-architecture)
- [Architecture Diagrams](#-architecture-diagrams)
- [Quick Links](#-quick-links)

---

## 🚀 Getting Started

New to `openframe-oss-lib`? Start here:

| Document | Description |
|----------|-------------|
| [Introduction](./getting-started/introduction.md) | What OpenFrame OSS Lib is, key features, and the platform overview |
| [Prerequisites](./getting-started/prerequisites.md) | Required tools, system requirements, and infrastructure dependencies |
| [Quick Start](./getting-started/quick-start.md) | Clone, build, and use a module as a dependency in 5 minutes |
| [First Steps](./getting-started/first-steps.md) | Explore module structure, domain models, tests, and the community |

---

## 🛠️ Development

Guides for working with and contributing to the codebase:

| Document | Description |
|----------|-------------|
| [Development Overview](./development/README.md) | Technology stack, module organization, and community links |
| [Environment Setup](./development/setup/environment.md) | IDE setup, Java 21, Maven, Docker, and Node.js installation |
| [Local Development](./development/setup/local-development.md) | Build commands, running tests, debugging, and Maven workflows |
| [Architecture Overview](./development/architecture/README.md) | High-level system design, request flows, and design decisions |
| [Security Guidelines](./development/security/README.md) | Auth architecture, secrets management, and secure coding practices |
| [Testing Guide](./development/testing/README.md) | Test structure, Testcontainers, writing unit and integration tests |
| [Contributing Guidelines](./development/contributing/guidelines.md) | Code style, branch naming, commit messages, and PR process |

---

## 📐 Reference Architecture

Deep-dive documentation for each major module, generated from source code analysis:

| Module | Description |
|--------|-------------|
| [API Lib Contracts](./reference/architecture/api-lib-contracts/api-lib-contracts.md) | Shared DTOs, filter criteria, Relay pagination primitives, and mappers |
| [API Service Core (HTTP + GraphQL)](./reference/architecture/api-service-core-http-and-graphql/api-service-core-http-and-graphql.md) | REST controllers, GraphQL DGS DataFetchers, DataLoaders, and security |
| [Authorization Service Core](./reference/architecture/authorization-service-core/authorization-service-core.md) | Multi-tenant OAuth2/OIDC, JWT issuance, SSO (Google/Microsoft), Mongo persistence |
| [Gateway Service Core](./reference/architecture/gateway-service-core/gateway-service-core.md) | Reactive edge layer — JWT validation, API key auth, rate limiting, WebSocket proxying |
| [Data Models and Repositories (Mongo)](./reference/architecture/data-models-and-repositories-mongo/data-models-and-repositories-mongo.md) | MongoDB documents, reactive + sync repositories, cursor pagination, tenant isolation |
| [Management Service Core](./reference/architecture/management-service-core/management-service-core.md) | Operational control plane — schedulers, migrations (Mongock), NATS initialization |
| [Stream Processing (Kafka)](./reference/architecture/stream-processing-kafka/stream-processing-kafka.md) | Debezium CDC ingestion, event normalization, Kafka Streams enrichment, Cassandra persistence |
| [Frontend Core UI and Chat](./reference/architecture/frontend-core-ui-and-chat/frontend-core-ui-and-chat.md) | Embeddable AI assistant, Kanban board, Ticket Center, Notifications, DataTable system |

---

## 🗺️ Architecture Diagrams

Visual Mermaid diagrams are available in the `docs/diagrams/architecture/` directory. Each module has multiple diagrams covering data flows, component relationships, and sequence interactions:

| Diagram Set | Module |
|------------|--------|
| `docs/diagrams/architecture/README*.mmd` | Overall platform architecture |
| `docs/diagrams/architecture/api-service-core-http-and-graphql*.mmd` | API layer flows |
| `docs/diagrams/architecture/authorization-service-core*.mmd` | Auth and token flows |
| `docs/diagrams/architecture/gateway-service-core*.mmd` | Gateway routing and security |
| `docs/diagrams/architecture/data-models-and-repositories-mongo*.mmd` | Data layer architecture |
| `docs/diagrams/architecture/management-service-core*.mmd` | Management and scheduling flows |
| `docs/diagrams/architecture/stream-processing-kafka*.mmd` | Event ingestion pipeline |
| `docs/diagrams/architecture/frontend-core-ui-and-chat*.mmd` | UI and chat architecture |
| `docs/diagrams/architecture/api-lib-contracts*.mmd` | Contract layer relationships |

---

## 🔗 Quick Links

| Resource | Link |
|----------|------|
| **Project README** | [../README.md](../README.md) |
| **Contributing Guide** | [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| **OpenFrame Platform** | [https://openframe.ai](https://openframe.ai) |
| **Flamingo** | [https://flamingo.run](https://flamingo.run) |
| **OpenMSP Community** | [https://www.openmsp.ai/](https://www.openmsp.ai/) |
| **Join Slack** | [OpenMSP Slack Invite](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) |

---

*Documentation generated by [OpenFrame Doc Orchestrator](https://github.com/flamingo-stack/openframe-oss-tenant)*
