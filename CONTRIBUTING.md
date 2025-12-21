# Contributing to OpenFrame OSS Library

Thank you for your interest in contributing to the OpenFrame OSS Library! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

We welcome contributions of all kinds:

- 🐛 **Bug Reports** - Help us identify and fix issues
- 💡 **Feature Requests** - Suggest new functionality
- 📖 **Documentation** - Improve guides and API docs
- 🔧 **Code Contributions** - Submit bug fixes and new features
- 🧪 **Testing** - Add test coverage and validation

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Java**: JDK 8+ (JDK 11 or 17 LTS recommended)
- **Build Tools**: Maven 3.6+ or Gradle 6.0+
- **IDE**: IntelliJ IDEA, Eclipse, or VS Code with Java extensions
- **Git**: Version 2.20+

### Required IDE Plugins

- **Lombok**: For annotation processing
- **Java Language Support**: For syntax highlighting and IntelliSense
- **Maven/Gradle Integration**: For dependency management

### Development Setup

1. **Fork the Repository**
   ```bash
   # Fork via GitHub UI, then clone your fork
   git clone https://github.com/YOUR_USERNAME/openframe-oss-lib.git
   cd openframe-oss-lib
   ```

2. **Set Up Upstream Remote**
   ```bash
   git remote add upstream https://github.com/flamingo-stack/openframe-oss-lib.git
   git fetch upstream
   ```

3. **Install Dependencies & Build**
   ```bash
   # Using Maven
   mvn clean install
   
   # Using Gradle
   ./gradlew build
   ```

4. **Run Tests**
   ```bash
   # Using Maven
   mvn test
   
   # Using Gradle
   ./gradlew test
   ```

For detailed setup instructions, see our [Development Guide](./docs/development/setup/environment.md).

## 📋 Development Workflow

### Branch Strategy

- **main** - Stable release branch
- **develop** - Integration branch for new features
- **feature/[name]** - Feature development branches
- **bugfix/[name]** - Bug fix branches
- **release/v[version]** - Release preparation branches
- **hotfix/v[version]** - Critical production fixes

### Making Changes

1. **Create a Feature Branch**
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clean, documented code
   - Follow coding standards (see below)
   - Add/update tests as needed
   - Update documentation if applicable

3. **Test Your Changes**
   ```bash
   # Run all tests
   mvn test
   
   # Run specific test categories
   mvn test -Dtest="*UnitTest"
   mvn test -Dtest="*IntegrationTest"
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add device status filtering capability"
   ```

5. **Push and Create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📝 Coding Standards

### Code Style

- **Java Conventions**: Follow standard Java naming conventions
- **Lombok**: Use Lombok annotations to reduce boilerplate
- **Immutable Objects**: Prefer immutable DTOs with builder patterns
- **Null Safety**: Handle nulls explicitly, use Optional where appropriate

### Example DTO Structure

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ExampleDTO {
    @JsonProperty("id")
    private String id;
    
    @JsonProperty("name")
    private String name;
    
    @JsonProperty("created_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    private Instant createdAt;
    
    @JsonProperty("metadata")
    private Map<String, Object> metadata;
}
```

### Documentation Standards

- **Javadoc**: All public classes and methods
- **README Updates**: For new features and breaking changes
- **Architecture Docs**: Update mermaid diagrams for structural changes

```java
/**
 * Represents a device filter option for querying devices.
 * Provides flexible filtering capabilities across multiple device attributes.
 * 
 * @since 1.0.0
 * @see DeviceFilters
 */
@Data
@Builder
public class DeviceFilterOption {
    // Implementation
}
```

## 🧪 Testing Requirements

### Test Categories

- **Unit Tests**: Component-level testing with JUnit
- **Integration Tests**: Multi-component interaction testing
- **JSON Serialization Tests**: Ensure proper JSON mapping
- **Builder Pattern Tests**: Validate Lombok-generated builders

### Coverage Requirements

- **Minimum Coverage**: 80% line coverage
- **Critical Paths**: 95% coverage for core DTOs
- **New Features**: 100% coverage requirement

### Test Structure

```java
class LogEventTest {
    
    @Test
    void shouldCreateLogEventWithBuilder() {
        // Given
        String toolType = "security-scanner";
        String severity = "HIGH";
        
        // When
        LogEvent logEvent = LogEvent.builder()
            .toolType(toolType)
            .severity(severity)
            .build();
        
        // Then
        assertThat(logEvent.getToolType()).isEqualTo(toolType);
        assertThat(logEvent.getSeverity()).isEqualTo(severity);
    }
    
    @Test
    void shouldSerializeToJsonCorrectly() throws Exception {
        // Test JSON serialization
    }
}
```

## 🔍 Code Review Process

### Pull Request Guidelines

1. **Clear Description**: Explain what changes were made and why
2. **Link Issues**: Reference related issues using `Fixes #123`
3. **Small, Focused Changes**: Keep PRs focused on a single concern
4. **Tests Included**: All new functionality must include tests
5. **Documentation Updated**: Update docs for user-facing changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
```

### Review Criteria

- **Functionality**: Does the code work as intended?
- **Tests**: Are changes adequately tested?
- **Design**: Is the code well-structured and maintainable?
- **Documentation**: Are changes properly documented?
- **Performance**: Are there any performance implications?

## 🐛 Bug Reports

When reporting bugs, please include:

- **Environment**: Java version, OS, library version
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Code Examples**: Minimal reproducing example
- **Error Messages**: Full stack traces if applicable

### Bug Report Template

```markdown
**Environment:**
- Java Version: 11.0.2
- Library Version: 1.0.0
- OS: macOS 12.0

**Steps to Reproduce:**
1. Create LogEvent with null severity
2. Serialize to JSON
3. Observe error

**Expected Behavior:**
Should handle null values gracefully

**Actual Behavior:**
NullPointerException thrown during serialization

**Code Example:**
```java
LogEvent event = LogEvent.builder()
    .toolType("scanner")
    .severity(null)  // This causes the issue
    .build();
```

**Error Message:**
```
java.lang.NullPointerException: Cannot invoke "String.toLowerCase()" because "severity" is null
```
```

## 💡 Feature Requests

For new features, please:

1. **Check Existing Issues**: Ensure the feature hasn't been requested
2. **Describe Use Case**: Explain why the feature is needed
3. **Propose Solution**: Suggest how it might work
4. **Consider Alternatives**: Are there other ways to achieve the goal?

## 📚 Documentation Contributions

Documentation improvements are always welcome:

- **Getting Started Guides**: Help new users get up to speed
- **API Documentation**: Improve Javadoc and reference docs
- **Examples**: Add practical usage examples
- **Architecture Docs**: Update system design documentation

## 🔒 Security

If you discover a security vulnerability:

1. **Do NOT** create a public issue
2. **Contact** the maintainers privately
3. **Provide** detailed information about the vulnerability
4. **Wait** for confirmation before public disclosure

## 📞 Community & Support

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Requests**: Code contributions and reviews

### Getting Help

- Check the [Documentation](./docs/README.md)
- Search existing GitHub issues
- Ask questions in GitHub Discussions
- Review the [Development Guide](./docs/development/README.md)

## 📄 License

By contributing to OpenFrame OSS Library, you agree that your contributions will be licensed under the Flamingo AI Unified License v1.0.

## 🙏 Recognition

Contributors are recognized in:

- **CONTRIBUTORS.md**: List of all contributors
- **Release Notes**: Major contributions highlighted
- **Community**: Appreciation in community channels

---

## Quick Start for Contributors

1. **[Set up environment](./docs/development/setup/environment.md)** - Get your development environment ready
2. **[Understand architecture](./docs/development/architecture/overview.md)** - Learn the system design  
3. **[Review testing guide](./docs/development/testing/overview.md)** - Understand testing requirements
4. **[Read coding guidelines](./docs/development/contributing/guidelines.md)** - Follow our coding standards

Thank you for contributing to OpenFrame OSS Library! Your efforts help improve the OpenFrame ecosystem for everyone.

---

**Questions?** Feel free to reach out via GitHub Issues or Discussions. We're here to help make your contribution experience smooth and rewarding.