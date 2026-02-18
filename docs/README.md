# OpenFrame OSS Lib Documentation

Welcome to the comprehensive documentation for **OpenFrame OSS Lib** – the foundational backend library suite powering AI-driven MSP platforms.

## 📚 Table of Contents

### Getting Started

New to OpenFrame OSS Lib? Start here to understand the project and get up and running quickly:

- [Introduction](./getting-started/introduction.md) - What is OpenFrame OSS Lib and why use it
- [Prerequisites](./getting-started/prerequisites.md) - System requirements and setup
- [Quick Start](./getting-started/quick-start.md) - Build and run in 5 minutes
- [First Steps](./getting-started/first-steps.md) - Explore key features and concepts

### Development

Guides for developers working with or extending OpenFrame OSS Lib:

- [Development Overview](./development/README.md) - Development workflow and standards
- [Local Development Setup](./development/setup/local-development.md) - Complete development environment
- [Environment Configuration](./development/setup/environment.md) - Configuration and dependencies
- [Architecture Overview](./development/architecture/README.md) - System design and patterns
- [Contributing Guidelines](./development/contributing/guidelines.md) - How to contribute effectively
- [Testing Guide](./development/testing/README.md) - Testing patterns and requirements
- [Security Best Practices](./development/security/README.md) - Security guidelines and standards

### Reference Documentation

Technical reference documentation for all modules and components:

- [API Service Core](./reference/architecture/api-service-core/api-service-core.md) - Internal REST & GraphQL APIs
- [API Lib Contracts](./reference/architecture/api-lib-contracts/api-lib-contracts.md) - Shared DTOs, filters, and mappers
- [Authorization Service Core](./reference/architecture/authorization-service-core/authorization-service-core.md) - Multi-tenant OAuth2 server
- [Client Service Core](./reference/architecture/client-service-core/client-service-core.md) - Agent lifecycle management
- [Core Shared Utilities](./reference/architecture/core-shared-utilities/core-shared-utilities.md) - Common utilities and helpers
- [Data Kafka Foundation](./reference/architecture/data-kafka-foundation/data-kafka-foundation.md) - Event streaming infrastructure
- [Data Mongo Domain & Repos](./reference/architecture/data-mongo-domain-and-repos/data-mongo-domain-and-repos.md) - MongoDB domain models
- [Data Platform Cassandra & Pinot](./reference/architecture/data-platform-cassandra-and-pinot/data-platform-cassandra-and-pinot.md) - Analytics data layer
- [Data Redis Cache](./reference/architecture/data-redis-cache/data-redis-cache.md) - Distributed caching layer
- [External API Service Core](./reference/architecture/external-api-service-core/external-api-service-core.md) - Public API endpoints
- [Gateway Service Core](./reference/architecture/gateway-service-core/gateway-service-core.md) - API gateway and routing
- [Integrations SDKs](./reference/architecture/integrations-sdks/integrations-sdks.md) - External tool integration libraries
- [Management Service Core](./reference/architecture/management-service-core/management-service-core.md) - Platform operations and bootstrapping
- [Security Core & OAuth BFF](./reference/architecture/security-core-and-oauth-bff/security-core-and-oauth-bff.md) - Authentication utilities
- [Stream Processing Core](./reference/architecture/stream-processing-core/stream-processing-core.md) - Real-time event processing

### Architecture Diagrams

Visual documentation of system architecture and component interactions:

- **Component Diagrams**: View Mermaid diagrams in `./docs/diagrams/architecture/`
- **Service Interaction Flows**: Real-time data processing pipelines
- **Security Architecture**: Multi-tenant isolation and authentication flows
- **Data Flow Diagrams**: Event-driven architecture patterns

## 🚀 Quick Navigation

### For New Users
1. Start with [Introduction](./getting-started/introduction.md) to understand the project
2. Follow [Quick Start](./getting-started/quick-start.md) to build the libraries
3. Explore [First Steps](./getting-started/first-steps.md) for hands-on examples

### For Developers
1. Review [Architecture Overview](./development/architecture/README.md) for system design
2. Set up [Local Development](./development/setup/local-development.md) environment
3. Read [Contributing Guidelines](./development/contributing/guidelines.md) before making changes

### For Integration Partners  
1. Check [API Service Core](./reference/architecture/api-service-core/api-service-core.md) for REST/GraphQL endpoints
2. Review [Gateway Service Core](./reference/architecture/gateway-service-core/gateway-service-core.md) for routing
3. Explore [Integrations SDKs](./reference/architecture/integrations-sdks/integrations-sdks.md) for tool connectors

### For Platform Builders
1. Study [Authorization Service Core](./reference/architecture/authorization-service-core/authorization-service-core.md) for OAuth2 setup  
2. Learn about [Data Platform](./reference/architecture/data-platform-cassandra-and-pinot/data-platform-cassandra-and-pinot.md) for analytics
3. Understand [Stream Processing](./reference/architecture/stream-processing-core/stream-processing-core.md) for real-time features

## 🔑 Key Concepts

### Multi-Tenant Architecture
OpenFrame OSS Lib enforces tenant isolation at every layer - from JWT validation to database queries. Every component includes tenant-aware functionality.

### Event-Driven Design  
The platform uses Kafka for event streaming with Kafka Streams for real-time processing. Events flow from operational systems to analytics databases.

### Microservice Foundation
Each module is designed as a focused microservice component with clear boundaries, allowing you to use only what you need.

### Security by Default
OAuth2, JWT validation, input sanitization, and tenant isolation are built into every component - security isn't an afterthought.

### Tool-Agnostic Integration
Connect any MSP tool (RMM, PSA, MDM) through standardized SDK interfaces without vendor lock-in.

## 🛠️ Module Categories

### Core Infrastructure
- **openframe-core**: Shared utilities and validation
- **openframe-api-lib-contracts**: API contracts and DTOs

### Security & Identity
- **openframe-authorization-service-core**: OAuth2 authorization server
- **openframe-security-core-and-oauth-bff**: JWT utilities and BFF flows

### API & Gateway  
- **openframe-gateway-service-core**: Reactive API gateway
- **openframe-api-service-core**: Internal REST + GraphQL APIs
- **openframe-external-api-service-core**: Public API endpoints

### Data Infrastructure
- **openframe-data-mongo-domain-and-repos**: Operational data (MongoDB)
- **openframe-data-redis-cache**: Distributed caching (Redis)
- **openframe-data-kafka-foundation**: Event streaming (Kafka)
- **openframe-data-platform-cassandra-and-pinot**: Analytics (Cassandra + Pinot)

### Business Services
- **openframe-client-service-core**: Agent lifecycle with NATS
- **openframe-stream-processing-core**: Real-time event processing
- **openframe-management-service-core**: Platform operations

### Tool Integration
- **openframe-integrations-sdks**: External MSP tool connectors

## 📖 Quick Links

- [Project README](../README.md) - Main project overview and quick start
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute to the project
- [License](../LICENSE.md) - License terms and conditions

## 🤝 Community & Support

All discussions and support happen in our Slack community:

- **OpenMSP Slack**: [Join here](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **Platform Website**: [https://www.openmsp.ai/](https://www.openmsp.ai/)
- **OpenFrame Platform**: [https://openframe.ai](https://openframe.ai)

**Note**: We don't use GitHub Issues or Discussions - everything happens in Slack for faster collaboration and support.

## 🔄 Documentation Updates

This documentation is continuously updated as the project evolves. For the most current information:

1. Check the [getting-started guides](./getting-started/) for setup changes
2. Review [reference documentation](./reference/architecture/) for API updates  
3. Monitor Slack announcements for breaking changes
4. Contribute documentation improvements via pull requests

---

*Documentation generated by [OpenFrame Doc Orchestrator](https://github.com/flamingo-stack/openframe-oss-tenant)*

**Need help?** Join our [OpenMSP Slack community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) - we're here to help! 🚀