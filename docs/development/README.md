# Development Documentation

Welcome to the OpenFrame OSS Lib development documentation. This section provides comprehensive guides for developers working with, extending, or contributing to the OpenFrame platform libraries.

## Getting Started with Development

If you're new to OpenFrame OSS Lib development, start here:

1. **[Environment Setup](setup/environment.md)** - Configure your development environment
2. **[Local Development](setup/local-development.md)** - Run and debug locally
3. **[Architecture Overview](architecture/README.md)** - Understand the system design

## Development Guides

### Setup & Configuration
- **[Development Environment](setup/environment.md)** - IDE, tools, and configuration
- **[Local Development](setup/local-development.md)** - Running services locally

### Architecture & Design  
- **[Architecture Overview](architecture/README.md)** - System architecture and design patterns
- **[Module Dependencies](architecture/README.md#module-structure)** - Understanding module relationships
- **[Data Flow](architecture/README.md#data-flow)** - How data moves through the system

### Security Implementation
- **[Security Best Practices](security/README.md)** - Authentication, authorization, and security patterns
- **[OAuth2 Implementation](security/README.md#oauth2-flows)** - Multi-tenant OAuth2 setup
- **[JWT Handling](security/README.md#jwt-processing)** - Token validation and claims

### Testing Strategy
- **[Testing Overview](testing/README.md)** - Test structure and strategies  
- **[Unit Testing](testing/README.md#unit-testing)** - Writing effective unit tests
- **[Integration Testing](testing/README.md#integration-testing)** - End-to-end testing approaches

### Contributing
- **[Contributing Guidelines](contributing/guidelines.md)** - Code style, PR process, and best practices
- **[Code Review](contributing/guidelines.md#code-review)** - Review checklist and standards
- **[Release Process](contributing/guidelines.md#release-process)** - How releases are managed

## Quick Navigation

### By Developer Role

**Backend Developers**
- Start with [Architecture Overview](architecture/README.md)
- Focus on [Local Development](setup/local-development.md)  
- Review [Testing Guide](testing/README.md)

**DevOps Engineers**
- Begin with [Environment Setup](setup/environment.md)
- Study [Security Practices](security/README.md)
- Check deployment patterns in Architecture

**Contributors**  
- Read [Contributing Guidelines](contributing/guidelines.md)
- Set up [Development Environment](setup/local-development.md)
- Review [Testing Requirements](testing/README.md)

### By Technology Stack

**Spring Boot Development**
- [Architecture patterns](architecture/README.md) - Service layer design
- [Security configuration](security/README.md) - OAuth2 and JWT
- [Testing approaches](testing/README.md) - Spring Boot testing

**Database Development**
- [Data architecture](architecture/README.md#data-layer) - Multi-database patterns
- [Repository patterns](architecture/README.md#persistence-patterns) - MongoDB, Redis, Cassandra
- [Migration strategies](setup/local-development.md#database-setup) - Schema evolution

**API Development**  
- [REST API patterns](architecture/README.md#api-design) - OpenAPI and validation
- [GraphQL implementation](architecture/README.md#graphql-layer) - Netflix DGS patterns
- [API security](security/README.md#api-protection) - Authentication flows

**Microservice Patterns**
- [Gateway configuration](architecture/README.md#gateway-layer) - Spring Cloud Gateway
- [Service communication](architecture/README.md#inter-service-communication) - Synchronous and async
- [Distributed tracing](setup/local-development.md#observability) - Monitoring and logging

## Development Workflow

### Daily Development
1. **Pull latest changes**: `git pull origin main`
2. **Run tests**: `mvn test` (before making changes)
3. **Make focused changes**: Single responsibility principle
4. **Write/update tests**: Maintain test coverage  
5. **Build locally**: `mvn clean install`
6. **Create PR**: Follow contributing guidelines

### Feature Development
1. **Review architecture**: Understand impact on system design
2. **Design API contracts**: Update DTOs and interfaces first
3. **Implement core logic**: Focus on business logic
4. **Add security**: Authentication and authorization
5. **Write comprehensive tests**: Unit and integration coverage
6. **Update documentation**: Keep docs current

### Debugging & Troubleshooting
1. **Check logs**: Application and system logs
2. **Use IDE debugging**: Set breakpoints strategically  
3. **Test isolation**: Reproduce issues in minimal test cases
4. **Profile performance**: Use built-in profiling tools
5. **Community support**: Ask questions in OpenMSP Slack

## Key Development Concepts

### Multi-Tenant Architecture
OpenFrame is designed for multi-tenant SaaS deployments. Every service must handle:
- Tenant isolation at data level
- Tenant-aware security contexts  
- Tenant-specific configuration
- Cross-tenant data protection

### Event-Driven Design
The platform processes high volumes of device and log data:
- Asynchronous event processing
- Kafka-based event streams
- Event sourcing patterns
- Real-time analytics pipelines

### Modular Architecture
Clean separation of concerns across modules:
- Single responsibility per module
- Clear interface contracts
- Minimal inter-module coupling
- Extensible plugin patterns

## Tools and Technologies

### Development Stack
- **Language**: Java 21
- **Framework**: Spring Boot 3.3.0  
- **Build**: Maven 3.8+
- **Testing**: JUnit 5, TestContainers
- **Security**: Spring Security, JWT
- **Databases**: MongoDB, Redis, Cassandra, Pinot
- **Messaging**: Kafka, NATS
- **API**: REST, GraphQL (Netflix DGS)

### Development Tools
- **IDEs**: IntelliJ IDEA (recommended), Eclipse, VS Code
- **Debugging**: IDE debuggers, logging frameworks
- **Profiling**: JProfiler, async-profiler  
- **API Testing**: Postman, curl, automated tests
- **Database Tools**: MongoDB Compass, Redis CLI

### Observability
- **Logging**: Logback with structured logging
- **Metrics**: Micrometer with monitoring integration
- **Tracing**: Distributed tracing capabilities
- **Health Checks**: Spring Boot Actuator

## Community & Support

### Getting Help
- **Technical Questions**: [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **Bug Reports**: GitHub Issues (when available)
- **Feature Requests**: Community discussion in Slack
- **Documentation Issues**: Report in community channels

### Contributing Back
- **Code Contributions**: Follow [Contributing Guidelines](contributing/guidelines.md)
- **Documentation**: Help improve and expand documentation
- **Testing**: Add test cases and scenarios
- **Community Support**: Help other developers in Slack

### Staying Updated
- **Release Notes**: Track new features and changes
- **Architecture Decisions**: Follow design evolution
- **Best Practices**: Learn from community experiences
- **Technology Updates**: Stay current with Spring Boot and Java

---

Ready to start developing? Begin with [Environment Setup](setup/environment.md) or dive into [Architecture Overview](architecture/README.md) to understand the system design.