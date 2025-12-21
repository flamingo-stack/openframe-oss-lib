# OpenFrame OSS Library Documentation

Welcome to the comprehensive documentation for the OpenFrame OSS Library, a robust Java library for audit logging and device management within the OpenFrame API ecosystem.

## 📚 Table of Contents

### Getting Started
Start here if you're new to the project:
- **[Introduction](./getting-started/introduction.md)** - What is OpenFrame OSS Library and why use it?
- **[Prerequisites](./getting-started/prerequisites.md)** - System requirements and setup checklist
- **[Quick Start](./getting-started/quick-start.md)** - Get up and running in 5 minutes
- **[First Steps](./getting-started/first-steps.md)** - Essential concepts and next steps

### Development
For contributors and developers:
- **[Development Overview](./development/README.md)** - Complete development documentation index
- **[Environment Setup](./development/setup/environment.md)** - Configure your development environment
- **[Local Development](./development/setup/local-development.md)** - Clone, build, and run the project locally
- **[Architecture Overview](./development/architecture/overview.md)** - Deep dive into system architecture and design
- **[Testing Guide](./development/testing/overview.md)** - Comprehensive testing strategies and guidelines
- **[Contributing Guidelines](./development/contributing/guidelines.md)** - How to contribute code, documentation, and improvements

### Reference
Technical reference documentation:
- **[Architecture Overview](./reference/architecture/overview.md)** - High-level system architecture and component interactions
- **[Module 1 Reference](./reference/architecture/module_1.md)** - Core DTOs and data structures
- **[Module 2 Reference](./reference/architecture/module_2.md)** - Extended features and filtering capabilities
- **[Data Transfer Objects](./reference/architecture/)** - Complete DTO documentation:
  - [LogDetails](./reference/architecture/LogDetails.md) - Audit log detail structures
  - [LogFilterOptions](./reference/architecture/LogFilterOptions.md) - Log filtering capabilities
  - [DeviceFilterOption](./reference/architecture/DeviceFilterOption.md) - Device filtering options
  - [GenericQueryResult](./reference/architecture/GenericQueryResult.md) - Query result structures
  - [CountedGenericQueryResult](./reference/architecture/CountedGenericQueryResult.md) - Paginated query results

### Diagrams
Visual documentation and architecture diagrams:
- **[System Architecture Diagrams](./diagrams/architecture/)** - Mermaid diagrams showing component relationships
- **[Data Flow Diagrams](./diagrams/)** - Visual representation of data processing flows
- **[Module Interaction Diagrams](./diagrams/)** - How different modules work together

## 🚀 Quick Navigation

### For New Users
1. Start with **[Introduction](./getting-started/introduction.md)** to understand the library's purpose
2. Check **[Prerequisites](./getting-started/prerequisites.md)** to ensure your environment is ready
3. Follow the **[Quick Start](./getting-started/quick-start.md)** to see the library in action
4. Explore **[First Steps](./getting-started/first-steps.md)** for key concepts and usage patterns

### For Developers
1. Review **[Architecture Overview](./reference/architecture/overview.md)** to understand the system design
2. Set up your environment with **[Environment Setup](./development/setup/environment.md)**
3. Get the code running with **[Local Development](./development/setup/local-development.md)**
4. Read **[Contributing Guidelines](./development/contributing/guidelines.md)** before making changes

### For Advanced Users
1. Study **[Module Documentation](./reference/architecture/)** for detailed API references
2. Explore **[Testing Strategies](./development/testing/overview.md)** for quality assurance
3. Review **[Architecture Diagrams](./diagrams/)** for visual system understanding

## 🔧 Key Features Documentation

| Feature | Documentation | Description |
|---------|---------------|-------------|
| **Audit Logging** | [LogDetails](./reference/architecture/LogDetails.md) | Comprehensive audit trail management |
| **Device Management** | [DeviceFilterOption](./reference/architecture/DeviceFilterOption.md) | Advanced device filtering and queries |
| **Data Filtering** | [LogFilterOptions](./reference/architecture/LogFilterOptions.md) | Powerful filtering capabilities |
| **Pagination** | [CountedGenericQueryResult](./reference/architecture/CountedGenericQueryResult.md) | Handle large datasets efficiently |
| **Type Safety** | [GenericQueryResult](./reference/architecture/GenericQueryResult.md) | Strongly typed data structures |

## 💡 Common Use Cases

### Basic Audit Logging
```java
// Create and manage audit log events
LogEvent event = LogEvent.builder()
    .toolEventId("evt-12345")
    .eventType("USER_LOGIN")
    .severity("INFO")
    .build();
```
📖 **Learn more**: [Quick Start](./getting-started/quick-start.md) → [LogDetails Reference](./reference/architecture/LogDetails.md)

### Device Filtering
```java
// Apply sophisticated device filters
DeviceFilters filters = DeviceFilters.builder()
    .statuses(Arrays.asList("ACTIVE", "PENDING"))
    .deviceTypes(Arrays.asList("LAPTOP", "MOBILE"))
    .build();
```
📖 **Learn more**: [DeviceFilterOption](./reference/architecture/DeviceFilterOption.md) → [Module 2 Reference](./reference/architecture/module_2.md)

### Paginated Queries
```java
// Handle large result sets with pagination
CountedGenericQueryResult<LogDetails> results = 
    queryService.getLogs(filters, pageSize, offset);
```
📖 **Learn more**: [CountedGenericQueryResult](./reference/architecture/CountedGenericQueryResult.md) → [Architecture Overview](./reference/architecture/overview.md)

## 📖 Quick Links

### Repository
- **[Project README](../README.md)** - Main project overview and quick start
- **[Contributing Guidelines](../CONTRIBUTING.md)** - How to contribute to the project
- **[License](../LICENSE.md)** - Legal information and usage terms

### External Resources
- **[GitHub Repository](https://github.com/flamingo-stack/openframe-oss-lib)** - Source code and issue tracking
- **[Lombok Documentation](https://projectlombok.org/)** - Understanding Lombok annotations used in the project
- **[Maven Documentation](https://maven.apache.org/)** - Build system reference

### Support & Community
- **[GitHub Issues](https://github.com/flamingo-stack/openframe-oss-lib/issues)** - Report bugs and request features
- **[GitHub Discussions](https://github.com/flamingo-stack/openframe-oss-lib/discussions)** - Community Q&A and discussions

## 📊 Documentation Health

| Section | Status | Last Updated | Coverage |
|---------|--------|--------------|----------|
| Getting Started | ✅ Complete | Current | 100% |
| Development | ✅ Complete | Current | 95% |
| Reference | ✅ Complete | Current | 90% |
| Diagrams | ✅ Complete | Current | 85% |

## 🎯 Documentation Goals

Our documentation aims to:

- **Get you started quickly** with clear, actionable guides
- **Provide comprehensive reference** material for all features
- **Support different learning styles** with text, code examples, and diagrams
- **Keep content current** with the latest library developments
- **Enable community contributions** through clear guidelines

## 🔄 Contributing to Documentation

Found an error or want to improve our docs?

1. **Small fixes**: Edit directly via GitHub's web interface
2. **Larger changes**: Follow our [Contributing Guidelines](../CONTRIBUTING.md)
3. **New sections**: Discuss in [GitHub Issues](https://github.com/flamingo-stack/openframe-oss-lib/issues) first

All documentation follows our [Markdown Guidelines](../CONTRIBUTING.md#documentation-standards) and is built with the Flamingo documentation system.

---

*Documentation generated by [OpenFrame Doc Orchestrator](https://github.com/flamingo-stack/openframe-oss-tenant) - Part of the Flamingo Stack ecosystem*

**Ready to get started?** 🚀 Jump into the **[Introduction](./getting-started/introduction.md)** or **[Quick Start](./getting-started/quick-start.md)** guide!