# OpenFrame OSS Library Documentation

Welcome to the comprehensive documentation for **OpenFrame OSS Library** - the foundational building blocks for secure, scalable device and organization management platforms.

## 📚 Table of Contents

### Getting Started
Start here if you're new to the OpenFrame OSS Library:
- [Introduction](./getting-started/introduction.md) - What is OpenFrame OSS Library and who should use it
- [Prerequisites](./getting-started/prerequisites.md) - Development environment requirements
- [Quick Start](./getting-started/quick-start.md) - Get up and running in 5 minutes
- [First Steps](./getting-started/first-steps.md) - Explore core features and common patterns

### Development
For contributors and developers integrating with the library:
- [Development Overview](./development/README.md) - Development section index and overview
- [Environment Setup](./development/setup/environment.md) - Set up your development environment
- [Local Development](./development/setup/local-development.md) - Run and test locally
- [Architecture Overview](./development/architecture/overview.md) - System architecture and design patterns
- [Testing Guide](./development/testing/overview.md) - Testing strategies and best practices
- [Contributing Guidelines](./development/contributing/guidelines.md) - How to contribute to the project

### Reference
Technical reference documentation and API specifications:

#### Architecture Documentation
- [System Overview](./reference/architecture/overview.md) - High-level architecture and module organization
- [API Service Core](./reference/architecture/api_service_core_controller.md) - REST API controllers and endpoints
- [Data Models](./reference/architecture/data_mongo_document_device.md) - MongoDB entity models and schemas
- [Service Interfaces](./reference/architecture/api_lib_service.md) - Business logic service contracts

#### Core Components
- [DTOs and Data Transfer](./reference/architecture/api_lib_dto_shared.md) - Standardized data transfer objects
- [Device Management](./reference/architecture/api_lib_dto_device.md) - Device domain DTOs and models
- [Event Management](./reference/architecture/api_lib_dto_event.md) - Event processing and audit DTOs
- [Organization Management](./reference/architecture/api_lib_dto_organization.md) - Multi-tenant organization models
- [Tool Integration](./reference/architecture/api_lib_dto_tool.md) - Tool connectivity and management
- [Security Core](./reference/architecture/security_core_jwt.md) - Authentication and authorization

#### Data Layer
- [MongoDB Documents](./reference/architecture/data_mongo_document_event.md) - Entity models and database schemas
- [Repository Patterns](./reference/architecture/data_mongo_repository_event.md) - Data access layer interfaces
- [Configuration Management](./reference/architecture/data_config.md) - Data layer configuration and setup

#### External Integrations
- [TacticalRMM SDK](./reference/architecture/sdk_tacticalrmm.md) - TacticalRMM integration models
- [Fleet MDM SDK](./reference/architecture/sdk_fleetmdm_model.md) - Fleet MDM integration support
- [OAuth Services](./reference/architecture/security_oauth_service.md) - OAuth 2.0 and OIDC providers

### Diagrams
Visual documentation and architecture diagrams:
- [System Architecture](./diagrams/README.md) - Mermaid diagrams showing system structure and data flow
- [Service Interactions](./diagrams/README.md) - Component interaction and dependency diagrams
- [Data Flow Diagrams](./diagrams/README.md) - Request/response flow and processing pipelines

## 📖 Quick Links

### Essential Resources
- [Project README](../README.md) - Main project overview and quick start
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute to the project
- [License Information](../LICENSE.md) - Licensing terms and conditions

### Core Concepts
- **Multi-Tenancy**: Built-in support for secure, isolated tenant operations
- **Cursor Pagination**: Efficient navigation through large datasets
- **Event Processing**: Comprehensive audit trails and system monitoring
- **Tool Integration**: Plugin architecture for MSP tool connectivity
- **Security First**: JWT authentication with OAuth 2.0/OIDC support

### Common Use Cases
- **MSP Platform Development**: Building multi-client management dashboards
- **Device Management**: Inventory tracking, compliance monitoring, health alerts
- **Integration Projects**: Connecting existing tools to OpenFrame ecosystem
- **Enterprise Solutions**: Scalable device management with SSO and audit trails

## 🎯 Documentation by Audience

### For New Developers
1. Start with [Introduction](./getting-started/introduction.md) to understand the library's purpose
2. Review [Prerequisites](./getting-started/prerequisites.md) and set up your environment
3. Follow the [Quick Start](./getting-started/quick-start.md) guide for hands-on experience
4. Explore [First Steps](./getting-started/first-steps.md) for common patterns

### For Contributors
1. Read [Contributing Guidelines](./development/contributing/guidelines.md) for contribution process
2. Set up [Local Development](./development/setup/local-development.md) environment
3. Study [Architecture Overview](./development/architecture/overview.md) for design patterns
4. Review [Testing Guide](./development/testing/overview.md) for quality standards

### For Integrators
1. Review [System Overview](./reference/architecture/overview.md) for integration points
2. Study relevant DTOs: [Device](./reference/architecture/api_lib_dto_device.md), [Event](./reference/architecture/api_lib_dto_event.md), [Organization](./reference/architecture/api_lib_dto_organization.md)
3. Understand [Service Interfaces](./reference/architecture/api_lib_service.md) for business logic
4. Check [Security Core](./reference/architecture/security_core_jwt.md) for authentication patterns

### For Architects
1. Start with [Architecture Overview](./reference/architecture/overview.md) for system design
2. Review [Data Models](./reference/architecture/data_mongo_document_device.md) for persistence patterns
3. Study [Service Architecture](./reference/architecture/api_service_core_controller.md) for API design
4. Examine [External Integrations](./reference/architecture/sdk_tacticalrmm.md) for extension patterns

## 🔍 Search and Navigation Tips

### Finding Specific Information
- Use your browser's search (Ctrl/Cmd + F) within documentation pages
- Check the [System Overview](./reference/architecture/overview.md) for component relationships
- Review DTOs for data structure definitions
- Look at service interfaces for available operations

### Understanding Relationships
- **DTOs → Data Models**: How API data maps to database entities
- **Services → Controllers**: How business logic connects to API endpoints
- **Configuration → Features**: How settings enable specific functionality
- **Security → Multi-tenancy**: How authentication enables tenant isolation

## 🆘 Getting Help

### Community Resources
- **Slack Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) - Active developer community
- **Platform Website**: [OpenFrame.ai](https://openframe.ai) - Product information and updates
- **Company Website**: [Flamingo.run](https://flamingo.run) - About the team and mission

### Documentation Feedback
Found something unclear or missing? We'd love to hear from you:
- Join our [Slack community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) and share feedback in `#documentation`
- Suggest improvements or corrections
- Request additional examples or clarifications

> **Note**: We manage all community discussions and support through our **OpenMSP Slack community**. GitHub Issues and Discussions are not actively monitored.

## 📈 What's Next?

Ready to dive in? Here are some suggested learning paths:

### Path 1: Quick Implementation (30 minutes)
1. [Prerequisites](./getting-started/prerequisites.md) → [Quick Start](./getting-started/quick-start.md) → [First Steps](./getting-started/first-steps.md)

### Path 2: Deep Architecture Understanding (2-3 hours)
1. [Introduction](./getting-started/introduction.md) → [Architecture Overview](./reference/architecture/overview.md) → [Development Guide](./development/README.md)

### Path 3: Contribution Preparation (1-2 hours)
1. [Contributing Guidelines](./development/contributing/guidelines.md) → [Local Development](./development/setup/local-development.md) → [Testing Guide](./development/testing/overview.md)

---

*Documentation generated by [OpenFrame Doc Orchestrator](https://github.com/flamingo-stack/openframe-oss-tenant)*

**Ready to build the future of MSP platforms?** Start with our [Getting Started guide](./getting-started/introduction.md) or jump into the [Quick Start](./getting-started/quick-start.md) for immediate hands-on experience!