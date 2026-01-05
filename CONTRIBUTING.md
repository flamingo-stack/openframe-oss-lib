# Contributing to OpenFrame OSS Library

Thank you for your interest in contributing to OpenFrame OSS Library! This document provides guidelines and information for contributors to help maintain the quality and consistency of the codebase.

## 🤝 Welcome Contributors

We welcome contributions from:
- MSP platform developers and integrators
- Java/Spring Boot developers
- DevOps and infrastructure engineers
- Documentation writers and technical writers
- Open source enthusiasts

## 📋 Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please:

- Be respectful and professional in all communications
- Focus on constructive feedback and collaboration
- Help create a positive community atmosphere
- Follow our community guidelines on the OpenMSP Slack

## 🚀 Getting Started

### 1. Join Our Community

Before contributing, join our community:
- **OpenMSP Slack**: [Join here](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- Introduce yourself in the `#general` channel
- Join relevant channels like `#development` or `#openframe-lib`

> **Important**: We manage all discussions, questions, and coordination through Slack. GitHub Issues and Discussions are not actively monitored.

### 2. Development Environment Setup

Prerequisites:
- Java 17 or higher
- Gradle 8.0+
- MongoDB 7.0+ (for testing)
- Git
- IDE with Java support (IntelliJ IDEA recommended)

Clone and setup:
```bash
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib
./gradlew build
```

See our [Development Setup Guide](./docs/development/setup/environment.md) for detailed instructions.

## 🎯 Types of Contributions

### 🐛 Bug Fixes
- Discuss the issue in Slack first
- Create descriptive commit messages
- Include tests for the fix
- Update documentation if needed

### ✨ New Features
- **Must** discuss feature proposals in Slack before starting
- Create feature design documents for significant changes
- Follow existing architectural patterns
- Include comprehensive tests
- Update documentation and examples

### 📚 Documentation
- Improve existing documentation clarity
- Add examples and use cases
- Fix typos and formatting issues
- Translate documentation (if applicable)

### 🧪 Testing
- Add unit tests for uncovered code
- Create integration tests
- Improve test infrastructure
- Performance testing and benchmarks

## 🔧 Development Guidelines

### Code Style

We use standard Java conventions with these specifics:

```java
// Class naming: PascalCase
public class DeviceManagementService {

    // Method naming: camelCase
    public DeviceResponse findDeviceById(String deviceId) {
        // Implementation
    }

    // Constants: UPPER_SNAKE_CASE
    private static final String DEFAULT_DEVICE_TYPE = "UNKNOWN";
}
```

**Formatting Rules:**
- 4 spaces for indentation (no tabs)
- 120 character line limit
- Use meaningful variable and method names
- Include JavaDoc for public methods

### Architecture Patterns

Follow these established patterns:

1. **DTOs for API boundaries**:
```java
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DeviceResponse {
    private String id;
    private String name;
    private DeviceType type;
    private Instant lastSeen;
}
```

2. **Service interfaces for business logic**:
```java
public interface DeviceService {
    CountedGenericQueryResult<Device> findDevices(DeviceFilterInput input);
    Device updateDevice(String id, DeviceUpdateRequest request);
}
```

3. **Cursor-based pagination**:
```java
@Data
public class DeviceFilterInput {
    @Valid
    private CursorPaginationInput pagination;
    
    @Valid
    private DeviceFilters filters;
}
```

### Testing Requirements

All contributions must include tests:

```java
@SpringBootTest
class DeviceServiceTest {
    
    @Test
    void shouldReturnDevicesWithFilters() {
        // Given
        DeviceFilterInput input = DeviceFilterInput.builder()
            .filters(DeviceFilters.builder().type("LAPTOP").build())
            .build();
            
        // When
        var result = deviceService.findDevices(input);
        
        // Then
        assertThat(result.getItems()).hasSize(2);
        assertThat(result.getItems()).allMatch(d -> d.getType() == DeviceType.LAPTOP);
    }
}
```

**Testing Guidelines:**
- Write unit tests for all new functionality
- Include integration tests for service endpoints
- Test edge cases and error conditions
- Maintain >80% code coverage for new code

## 📝 Pull Request Process

### 1. Before You Start
- Discuss your changes in Slack
- Create a feature branch: `git checkout -b feature/your-feature-name`
- Ensure your branch is up to date with main

### 2. Making Changes
- Follow the coding standards above
- Write or update tests
- Update documentation
- Commit frequently with descriptive messages

### 3. Commit Message Format
```
type(scope): brief description

Longer description explaining what and why.

Closes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(device): add device health status tracking

Add new health monitoring capabilities to device entities
including last check timestamp and health score.

fix(security): resolve JWT token validation issue

Fixes issue where expired tokens were not properly rejected
in multi-tenant environments.
```

### 4. Submitting Pull Request
- Push your branch: `git push origin feature/your-feature-name`
- Create a Pull Request on GitHub
- Fill out the PR template completely
- Link to relevant Slack discussions
- Request review from maintainers

### 5. Review Process
- Maintainers will review within 3-5 business days
- Address feedback and comments
- Update your branch as needed
- Maintain test coverage and documentation

## 🧪 Testing Your Changes

### Local Testing
```bash
# Run all tests
./gradlew test

# Run specific test class
./gradlew test --tests DeviceServiceTest

# Run with coverage
./gradlew test jacocoTestReport
```

### Integration Testing
```bash
# Start test dependencies
docker-compose up -d mongodb

# Run integration tests
./gradlew integrationTest
```

## 📚 Documentation Standards

### Code Documentation
- Add JavaDoc to all public methods
- Include parameter and return descriptions
- Document exceptions that may be thrown
- Provide usage examples for complex APIs

### README Updates
- Update feature lists for new capabilities
- Add examples for new functionality
- Keep installation instructions current

### Architecture Documentation
- Update architecture diagrams for structural changes
- Document new design patterns or conventions
- Explain integration points and dependencies

## 🔍 Quality Assurance

### Before Submitting
- [ ] All tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] No new security vulnerabilities
- [ ] Performance impact considered
- [ ] Multi-tenant compatibility verified

### Automated Checks
Our CI/CD pipeline runs:
- Unit and integration tests
- Code style validation
- Security vulnerability scanning
- Documentation building
- Compatibility testing

## 🏷️ Release Process

### Versioning
We follow [Semantic Versioning](https://semver.org/):
- `MAJOR.MINOR.PATCH`
- Breaking changes increment MAJOR
- New features increment MINOR
- Bug fixes increment PATCH

### Release Cycle
- Regular releases every 2-4 weeks
- Hotfixes released as needed
- Beta/RC releases for major versions
- Changelog maintained for all releases

## 🆘 Getting Help

### Resources
- **Documentation**: [./docs/README.md](./docs/README.md)
- **Development Guide**: [./docs/development/README.md](./docs/development/README.md)
- **Architecture Overview**: [./docs/reference/architecture/overview.md](./docs/reference/architecture/overview.md)

### Community Support
- **Slack**: [OpenMSP Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
  - `#development` - Development questions
  - `#openframe-lib` - Library-specific discussions
  - `#general` - General community chat

### Maintainer Contact
- Reach out in Slack for urgent issues
- Tag `@maintainers` for review requests
- Use `#development` channel for technical questions

## 🎉 Recognition

Contributors are recognized through:
- Contributor section in repository
- Special role in Slack community
- Annual contributor appreciation
- Opportunity to become maintainer

## 📄 License

By contributing to OpenFrame OSS Library, you agree that your contributions will be licensed under the [Flamingo AI Unified License v1.0](./LICENSE.md).

---

Thank you for contributing to OpenFrame OSS Library! Together we're building the future of open-source MSP platforms. 🚀

**Questions?** Join us on [Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) - we're here to help!