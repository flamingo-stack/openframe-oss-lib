# openframe-oss-lib Documentation

Welcome to the documentation for **openframe-oss-lib** — the foundational backend library powering the [OpenFrame](https://openframe.ai) platform.

This section contains comprehensive guides covering getting started, development workflows, security practices, testing strategies, and full reference architecture documentation for every module.

---

## 📚 Table of Contents

### Getting Started

- [Introduction](./getting-started/introduction.md) — What is openframe-oss-lib, key features, and high-level architecture
- [Prerequisites](./getting-started/prerequisites.md) — Required software, Java setup, GitHub Packages access, IDE configuration
- [Quick Start](./getting-started/quick-start.md) — Clone, build, and add modules as dependencies in 5 minutes
- [First Steps](./getting-started/first-steps.md) — Module structure, domain model exploration, security modules, and gateway overview

---

### Development

- [Development Overview](./development/README.md) — Index of all development documentation and quick navigation
- [Environment Setup](./development/setup/environment.md) — IDE configuration (IntelliJ / VS Code), Maven setup, Docker, environment variables
- [Local Development](./development/setup/local-development.md) — Clone, build, iterate, debug, and manage dependencies locally
- [Architecture Overview](./development/architecture/README.md) — System design, component relationships, data flows, and key design decisions
- [Security Best Practices](./development/security/README.md) — Auth patterns, multi-tenant key isolation, secrets management, input validation
- [Testing Overview](./development/testing/README.md) — Test structure, running tests, integration test infrastructure, writing new tests
- [Contributing Guidelines](./development/contributing/guidelines.md) — Code style, branching, commit conventions, and pull request process

---

### Reference Architecture

- [Repository Overview](./reference/architecture/README.md) — Full module index and end-to-end system view

#### API Foundation
- [API Contracts and Pagination](./reference/architecture/api-contracts-and-pagination/api-contracts-and-pagination.md) — Relay-style pagination, cursor codec, mutation inputs
- [API Domain Filters & DTOs](./reference/architecture/api-domain-filters-dtos/api-domain-filters-dtos.md) — Strongly-typed filter DTOs for devices, events, logs, and organizations
- [API Lib Core Services](./reference/architecture/api-lib-core-services/api-lib-core-services.md) — Reusable domain services: tool connections, ticket queries, device status
- [API Organization Mapping](./reference/architecture/api-organization-mapping/api-organization-mapping.md) — Organization-level API mapping layer

#### API Service Core
- [API Service Core Overview](./reference/architecture/api-service-core-user-sso-services-and-processors/api-service-core-user-sso-services-and-processors.md) — User SSO services and processors
- [API Service Core Services](./reference/architecture/api-service-core-user-sso-services-and-processors/services.md) — Core service implementations
- [API Service Core Processors](./reference/architecture/api-service-core-user-sso-services-and-processors/processors.md) — Processor implementations
- [REST Controllers](./reference/architecture/api-service-core-rest-controllers/api-service-core-rest-controllers.md) — Internal REST endpoints: organizations, devices, users, invitations, API keys
- [GraphQL Data Fetchers](./reference/architecture/api-service-core-graphql-datafetchers/api-service-core-graphql-datafetchers.md) — Relay-compliant GraphQL execution layer
- [GraphQL DTOs](./reference/architecture/api-service-core-graphql-dtos/api-service-core-graphql-dtos.md) — GraphQL input/output types
- [DataLoaders](./reference/architecture/api-service-core-dataloaders/api-service-core-dataloaders.md) — Batched DataLoader implementations for N+1 prevention
- [Relay Type Resolution](./reference/architecture/api-service-core-relay-type-resolution/api-service-core-relay-type-resolution.md) — Polymorphic Relay node type resolution
- [Config and Security](./reference/architecture/api-service-core-config-and-security/api-service-core-config-and-security.md) — JWT resource server, multi-issuer support, OAuth client initialization

#### Authorization Service Core
- [Server and Tenant](./reference/architecture/authorization-service-core-server-and-tenant/authorization-service-core-server-and-tenant.md) — Multi-tenant OAuth2 authorization server, tenant discovery and registration
- [Auth Controllers and DTOs](./reference/architecture/authorization-service-core-auth-controllers-and-dtos/authorization-service-core-auth-controllers-and-dtos.md) — Authentication controllers and data transfer objects
- [Keys and Authorization Persistence](./reference/architecture/authorization-service-core-keys-and-authorization-persistence/authorization-service-core-keys-and-authorization-persistence.md) — Per-tenant RSA key pairs, JWT issuance, persistence
- [SSO Flow and Utils](./reference/architecture/authorization-service-core-sso-flow-and-utils/authorization-service-core-sso-flow-and-utils.md) — Google and Microsoft SSO flows, PKCE support

#### Gateway Service Core
- [Gateway Security and Routing](./reference/architecture/gateway-service-core-security-and-routing/gateway-service-core-security-and-routing.md) — Reactive edge gateway, JWT validation, API key rate limiting, WebSocket proxying

#### Stream Service Core
- [Kafka and Handlers](./reference/architecture/stream-service-core-kafka-and-handlers/stream-service-core-kafka-and-handlers.md) — Debezium CDC ingestion, event enrichment, unified event type mapping

#### External API Service Core
- [External API Service](./reference/architecture/external-api-service-core/external-api-service-core.md) — Public REST interface for third-party integrations

#### Management Service Core
- [Initializers and Schedulers](./reference/architecture/management-service-core-initializers-and-schedulers/management-service-core-initializers-and-schedulers.md) — Startup initializers, ShedLock distributed schedulers

#### Security Core
- [Security Core and OAuth BFF](./reference/architecture/security-core-and-oauth-bff/security-core-and-oauth-bff.md) — PKCE utilities, JWT encoder/decoder, OAuth BFF login flow

#### Data Layer
- [MongoDB Domain Model](./reference/architecture/data-mongo-domain-model/data-mongo-domain-model.md) — Canonical MongoDB documents: User, Organization, Device, Ticket, Tool
- [MongoDB Base Repositories](./reference/architecture/data-mongo-base-repositories/data-mongo-base-repositories.md) — Base repository interfaces and patterns
- [MongoDB Query Filters](./reference/architecture/data-mongo-query-filters/data-mongo-query-filters.md) — MongoDB query filter construction
- [MongoDB Sync Config and Custom Repositories](./reference/architecture/data-mongo-sync-config-and-custom-repositories/data-mongo-sync-config-and-custom-repositories.md) — Synchronous repositories, index configuration, custom queries
- [MongoDB Reactive Repositories](./reference/architecture/data-mongo-reactive-repositories/data-mongo-reactive-repositories.md) — Reactive MongoDB repository layer
- [Redis Cache](./reference/architecture/data-redis-cache/data-redis-cache.md) — Tenant-aware cache key prefixing, Spring Cache integration
- [Kafka Configuration and Retry](./reference/architecture/data-kafka-configuration-and-retry/data-kafka-configuration-and-retry.md) — Multi-tenant Kafka config, topic provisioning, retry handling
- [NATS Notifications](./reference/architecture/data-nats-notifications/data-nats-notifications.md) — Persist-first notification strategy, read-state tracking, NATS publishing
- [Pinot Repositories](./reference/architecture/data-pinot-repositories/data-pinot-repositories.md) — Apache Pinot analytics queries for logs and device facets

---

### Architecture Diagrams

Visual Mermaid diagrams are available for every module under:

```text
docs/diagrams/architecture/
```

Diagrams cover request flows, data flows, class relationships, and sequence diagrams for all major components.

---

## 📖 Quick Links

- [Project README](../README.md) — Main project overview and quick start
- [Contributing Guide](../CONTRIBUTING.md) — How to contribute to openframe-oss-lib
- [OpenFrame Platform](https://openframe.ai) — The OpenFrame MSP platform
- [OpenMSP Community (Slack)](https://www.openmsp.ai/) — Community discussions and support
- [Flamingo](https://flamingo.run) — The team behind OpenFrame

---

*Documentation generated by [OpenFrame Doc Orchestrator](https://github.com/flamingo-stack/openframe-oss-tenant)*
