# OpenFrame OSS Lib — Documentation

Welcome to the documentation for **OpenFrame OSS Lib** (`flamingo-stack/openframe-oss-lib`), the core backend shared library collection of the [OpenFrame platform](https://openframe.ai).

This monorepo provides reusable Spring Boot modules that power every OpenFrame service: multi-tenant authentication, reactive API routing, event-driven stream processing, agent lifecycle management, and more.

---

## 📚 Table of Contents

- [Getting Started](#-getting-started)
- [Development](#-development)
- [Reference Architecture](#-reference-architecture)
- [Architecture Diagrams](#-architecture-diagrams)
- [CLI Tools](#-cli-tools)
- [Related Projects](#-related-projects)
- [Quick Links](#-quick-links)

---

## 🚀 Getting Started

New to OpenFrame OSS Lib? Start here:

| Guide | Description |
|---|---|
| [Introduction](./getting-started/introduction.md) | What is OpenFrame OSS Lib, key features, and target audience |
| [Prerequisites](./getting-started/prerequisites.md) | Required software (JDK 21, Maven, Docker, Node.js, Rust) |
| [Quick Start](./getting-started/quick-start.md) | Clone, build, and use modules in under 5 minutes |
| [First Steps](./getting-started/first-steps.md) | Explore the module hierarchy, domain model, and key patterns |

---

## 🛠 Development

Guides for developing, extending, testing, and contributing to the library:

| Guide | Description |
|---|---|
| [Development Overview](./development/README.md) | Technology stack, repository structure, documentation map |
| [Environment Setup](./development/setup/environment.md) | IDE configuration (IntelliJ, VS Code), plugins, editor extensions |
| [Local Development](./development/setup/local-development.md) | Clone, build, hot-reload patterns, debug configuration |
| [Architecture Overview](./development/architecture/README.md) | System design, component diagrams, data flow, key design decisions |
| [Security Best Practices](./development/security/README.md) | Auth patterns, tenant isolation, secrets management |
| [Testing Overview](./development/testing/README.md) | Test structure, running tests, Testcontainers, coverage guidelines |
| [Contributing Guidelines](./development/contributing/guidelines.md) | Code style, branch naming, PR process, commit format |

---

## 📖 Reference Architecture

Detailed technical documentation for each core module:

| Module | Description |
|---|---|
| [Authorization Service Core](./reference/architecture/authorization-service-core/authorization-service-core.md) | OAuth2/OIDC authorization server, JWT issuance, tenant resolution |
| [Authorization — Tenant Context](./reference/architecture/authorization-service-core/tenant-context.md) | Tenant context filter, `TenantContext` ThreadLocal, scoping |
| [Authorization — OAuth Persistence](./reference/architecture/authorization-service-core/oauth-persistence-and-services.md) | MongoDB-backed OAuth2 state persistence |
| [Authorization — Controllers](./reference/architecture/authorization-service-core/controllers.md) | Registration, invitation, password reset controllers |
| [Authorization — Configuration & Security](./reference/architecture/authorization-service-core/configuration-and-security.md) | Security filter chain, Spring Authorization Server config |
| [Authorization — Registration & Utilities](./reference/architecture/authorization-service-core/authorization-service-core/registration-and-utilities/registration-and-utilities.md) | Registration flows and utility helpers |
| [Gateway Service Core](./reference/architecture/gateway-service-core/gateway-service-core.md) | Reactive gateway, JWT validation, API key auth, rate limiting |
| [API Service Core — GraphQL](./reference/architecture/api-service-core-graphql/api-service-core-graphql.md) | Netflix DGS GraphQL API, Relay pagination, DataLoaders |
| [API Service Core — REST Controllers](./reference/architecture/api-service-core-rest-controllers/api-service-core-rest-controllers.md) | Internal REST endpoints, agent secrets, API key management |
| [API Service Core — DataLoaders](./reference/architecture/api-service-core-dataloaders/api-service-core-dataloaders.md) | Batching and N+1 elimination with DataLoaders |
| [API Service Core — Config & Security](./reference/architecture/api-service-core-config-and-security/api-service-core-config-and-security.md) | Security config, JWT resource server setup |
| [API Contracts and Mapping](./reference/architecture/api-contracts-and-mapping/api-contracts-and-mapping.md) | DTOs, mappers, and API contract definitions |
| [External REST API Service Core](./reference/architecture/external-rest-api-service-core/external-rest-api-service-core.md) | Public versioned REST API, tool proxying, OpenAPI docs |
| [Client Agent Service Core](./reference/architecture/client-agent-service-core/client-agent-service-core.md) | Agent registration, heartbeat, RMM execution, watchdog |
| [Data Mongo Domain Model](./reference/architecture/data-mongo-domain-model/data-mongo-domain-model.md) | MongoDB document definitions across all domains |
| [Data Mongo Sync Repositories](./reference/architecture/data-mongo-sync-repositories/data-mongo-sync-repositories.md) | Tenant-aware repositories, cursor pagination, aggregations |
| [Stream Processing Core](./reference/architecture/stream-processing-core/stream-processing-core.md) | Kafka event ingestion, enrichment, and state projection |

---

## 🗂 Architecture Diagrams

Visual documentation is available as Mermaid diagram files in:

```text
docs/diagrams/architecture/
```

Diagrams cover all major modules including:
- `authorization-service-core` — OAuth2 flows, tenant context
- `gateway-service-core` — Edge security flow
- `api-service-core-graphql` — GraphQL execution model
- `client-agent-service-core` — Agent lifecycle
- `stream-processing-core` — Kafka pipeline
- `data-mongo-domain-model` — Domain document relationships
- `data-mongo-sync-repositories` — Repository query patterns
- `configuration-and-security` — Security filter chain

---

## 🖥 CLI Tools

The OpenFrame Main CLI tool for self-hosted deployment is maintained in a separate repository:

- **Repository**: [flamingo-stack/openframe-cli](https://github.com/flamingo-stack/openframe-cli)
- **Documentation**: [CLI Documentation](https://github.com/flamingo-stack/openframe-cli/blob/main/docs/README.md)

> **Note:** CLI tools are NOT located in this repository. Always refer to the external repository for installation and usage.

---

## 🔗 Related Projects

| Project | Description |
|---|---|
| [openframe-oss-tenant](https://github.com/flamingo-stack/openframe-oss-tenant) | Main OpenFrame platform application — see how these modules are assembled |
| [openframe-cli](https://github.com/flamingo-stack/openframe-cli) | CLI tool for self-hosted deployment |
| [OpenFrame](https://openframe.ai) | Unified AI-driven MSP platform |
| [Flamingo](https://flamingo.run) | Commercial MSP platform powered by OpenFrame |

---

## 💬 Community & Support

Questions, ideas, and discussions live in the **OpenMSP Slack community**:

https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA

> We do not use GitHub Issues or GitHub Discussions — all coordination happens on Slack.

---

## 📎 Quick Links

- [Project README](../README.md) — Main project README
- [Contributing](../CONTRIBUTING.md) — How to contribute
- [License](../LICENSE.md) — License information
- [GitHub Repository](https://github.com/flamingo-stack/openframe-oss-lib) — Browse source and pull requests
- [GitHub Packages](https://github.com/flamingo-stack/openframe-oss-lib/releases) — Published releases

---

*Documentation generated by [🦩 Flamingo AI Technical Writer](https://flamingo.run)*
