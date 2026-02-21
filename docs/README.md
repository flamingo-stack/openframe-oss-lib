# OpenFrame OSS Lib Documentation

Welcome to the comprehensive documentation for **OpenFrame OSS Lib** - the modular, open-source foundation powering AI-driven MSP platforms and modern IT automation systems.

This documentation provides everything you need to understand, deploy, develop, and contribute to OpenFrame OSS Lib.

## 📚 Table of Contents

### Getting Started

**New to OpenFrame OSS Lib?** Start here to get up and running quickly:

- **[Introduction](./getting-started/introduction.md)** - Overview of OpenFrame OSS Lib and its capabilities
- **[Prerequisites](./getting-started/prerequisites.md)** - Development environment requirements
- **[Quick Start](./getting-started/quick-start.md)** - Get running in 5 minutes
- **[First Steps](./getting-started/first-steps.md)** - Explore key features and capabilities

### Development

**For developers working with or contributing to the codebase:**

- **[Development Overview](./development/README.md)** - Development environment and workflows
- **[Environment Setup](./development/setup/environment.md)** - Set up your development environment
- **[Local Development](./development/setup/local-development.md)** - Run the platform locally
- **[Architecture Guide](./development/architecture/README.md)** - System design and architectural patterns
- **[Testing Guide](./development/testing/README.md)** - Testing strategies, tools, and best practices
- **[Security Best Practices](./development/security/README.md)** - Security implementation guidelines
- **[Contributing Guidelines](./development/contributing/guidelines.md)** - How to contribute code and documentation

### Reference Documentation

**Technical reference documentation for all components:**

- **[API Service Core](./reference/architecture/api-service-core/api-service-core.md)** - Internal GraphQL + REST API layer
- **[Authorization Service Core](./reference/architecture/authorization-service-core/authorization-service-core.md)** - Multi-tenant OAuth2 authorization server
- **[Client Agent Core](./reference/architecture/client-agent-core/client-agent-core.md)** - Machine agent lifecycle management
- **[Core Utilities](./reference/architecture/core-utilities/core-utilities.md)** - Shared utilities and validation
- **[Data Kafka Core](./reference/architecture/data-kafka-core/data-kafka-core.md)** - Kafka infrastructure and event streaming
- **[Data Mongo Core](./reference/architecture/data-mongo-core/data-mongo-core.md)** - MongoDB persistence layer
- **[Data Platform Core](./reference/architecture/data-platform-core/data-platform-core.md)** - Pinot + Cassandra orchestration
- **[Data Redis Cache](./reference/architecture/data-redis-cache/data-redis-cache.md)** - Redis distributed caching
- **[External API Service Core](./reference/architecture/external-api-service-core/external-api-service-core.md)** - Public REST API
- **[Gateway Service Core](./reference/architecture/gateway-service-core/gateway-service-core.md)** - Reactive API Gateway
- **[Management Service Core](./reference/architecture/management-service-core/management-service-core.md)** - Infrastructure control plane
- **[Security And OAuth Core](./reference/architecture/security-and-oauth-core/security-and-oauth-core.md)** - JWT + PKCE utilities
- **[Security OAuth BFF](./reference/architecture/security-oauth-bff/security-oauth-bff.md)** - OAuth Backend-for-Frontend layer
- **[Stream Processing Core](./reference/architecture/stream-processing-core/stream-processing-core.md)** - Real-time event processing engine
- **[API Lib Contracts](./reference/architecture/api-lib-contracts/api-lib-contracts.md)** - Shared DTOs and contracts

### Visual Architecture Documentation

**Mermaid diagrams showing system architecture and component relationships:**

Comprehensive visual documentation is available in the [Architecture Diagrams](./diagrams/architecture/) directory, with detailed diagrams for each core component including:

- Service interaction flows
- Data flow diagrams  
- Authentication sequences
- Event streaming patterns
- Deployment topologies

### CLI Tools

**Command-line tools for deployment and management:**

The OpenFrame CLI tools are maintained in separate repositories for modularity:

#### OpenFrame CLI
The main CLI tool for self-hosting deployment and management:
- **Repository**: [flamingo-stack/openframe-cli](https://github.com/flamingo-stack/openframe-cli)
- **Documentation**: [CLI Documentation](https://github.com/flamingo-stack/openframe-cli/blob/main/docs/README.md)
- **Installation**: Follow the installation guide in the CLI repository
- **Usage**: Comprehensive command reference and examples

> **Note**: CLI tools are NOT located in this repository. Always refer to the external repositories for installation, usage, and contribution guidelines.

## 🚀 Quick Navigation

### By Role

**👩‍💻 For Developers**
1. [Prerequisites](./getting-started/prerequisites.md) → [Quick Start](./getting-started/quick-start.md) → [Local Development](./development/setup/local-development.md)
2. [Architecture Guide](./development/architecture/README.md) for system understanding
3. [Contributing Guidelines](./development/contributing/guidelines.md) for code contributions

**🏗️ For Platform Engineers**
1. [Introduction](./getting-started/introduction.md) → [Architecture Guide](./development/architecture/README.md)
2. [Reference Documentation](./reference/architecture/) for component details
3. [CLI Tools](#cli-tools) for deployment and management

**🔒 For Security Teams**
1. [Security Best Practices](./development/security/README.md)
2. [Authorization Service Core](./reference/architecture/authorization-service-core/authorization-service-core.md)
3. [Security And OAuth Core](./reference/architecture/security-and-oauth-core/security-and-oauth-core.md)

**🧪 For QA Engineers**
1. [Testing Guide](./development/testing/README.md)
2. [Environment Setup](./development/setup/environment.md)
3. [Local Development](./development/setup/local-development.md)

### By Use Case

**🔧 Setting Up Development Environment**
- [Prerequisites](./getting-started/prerequisites.md)
- [Environment Setup](./development/setup/environment.md)
- [Local Development](./development/setup/local-development.md)

**🏛️ Understanding Architecture**
- [Introduction](./getting-started/introduction.md)
- [Architecture Guide](./development/architecture/README.md)
- [Reference Documentation](./reference/architecture/)

**🔐 Implementing Security**
- [Security Best Practices](./development/security/README.md)
- [Authorization Service Core](./reference/architecture/authorization-service-core/authorization-service-core.md)
- [Gateway Service Core](./reference/architecture/gateway-service-core/gateway-service-core.md)

**📊 Working with Data**
- [Data Mongo Core](./reference/architecture/data-mongo-core/data-mongo-core.md)
- [Data Redis Cache](./reference/architecture/data-redis-cache/data-redis-cache.md)
- [Data Kafka Core](./reference/architecture/data-kafka-core/data-kafka-core.md)
- [Stream Processing Core](./reference/architecture/stream-processing-core/stream-processing-core.md)

## 🔍 What You'll Find Here

### **Comprehensive Guides**
- **Step-by-step tutorials** for getting started
- **Detailed setup instructions** for development environments
- **Best practices** for security, testing, and architecture
- **Contributing guidelines** for code and documentation

### **Technical References**
- **Complete API documentation** for all 15 core modules
- **Architecture diagrams** showing system design and data flows
- **Configuration guides** for databases, messaging, and caching
- **Security implementation details** for multi-tenant authorization

### **Development Resources**
- **Testing strategies** and automated test examples
- **Code quality standards** and style guidelines
- **Performance optimization** techniques
- **Troubleshooting guides** for common issues

## 🛟 Getting Help

### Community Support
- **💬 Slack Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) - All discussions, questions, and support

### Platform Resources
- **🌐 Flamingo Platform**: [flamingo.run](https://flamingo.run)
- **🔧 OpenFrame Platform**: [openframe.ai](https://openframe.ai)
- **📂 GitHub Repository**: [flamingo-stack/openframe-oss-lib](https://github.com/flamingo-stack/openframe-oss-lib)

> **Important**: We use the OpenMSP Slack community for all discussions, issues, and collaboration. GitHub Issues and Discussions are not actively monitored.

## 📖 Quick Links

- **[Project README](../README.md)** - Main project overview and features
- **[Contributing](../CONTRIBUTING.md)** - How to contribute to the project
- **[License](../LICENSE.md)** - License information and terms

---

## 🤝 Contributing to Documentation

Documentation improvements are always welcome! See our [Contributing Guidelines](../CONTRIBUTING.md) for information about:

- **Documentation standards** and style guide
- **Editing workflow** for documentation changes
- **Review process** for documentation PRs
- **Community guidelines** and code of conduct

---

*Documentation generated by [OpenFrame Doc Orchestrator](https://github.com/flamingo-stack/openframe-oss-tenant)*

**Ready to get started?** Begin with the [Introduction](./getting-started/introduction.md) or jump straight to the [Quick Start](./getting-started/quick-start.md) guide!