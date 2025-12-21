# Contributing to OpenFrame OSS Library

Thank you for your interest in contributing to the OpenFrame OSS Library! This document provides comprehensive guidelines for contributing to our Java-based DTO library for audit logging and device filtering.

## 🏗️ Development Environment Setup

### Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Java JDK** | 11+ | Runtime and compilation | Download from [OpenJDK](https://adoptopenjdk.net/) or Oracle |
| **Maven** | 3.6+ | Build automation | `brew install maven` (macOS) or [download](https://maven.apache.org/download.cgi) |
| **Git** | 2.20+ | Version control | Built-in on most systems |
| **IDE** | Latest | Development | [IntelliJ IDEA](https://www.jetbrains.com/idea/) (recommended) or Eclipse |
| **Lombok Plugin** | Latest | IDE support for annotations | Install from IDE marketplace |

### Setting Up Your Development Environment

1. **Fork and Clone the Repository**

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/openframe-oss-lib.git
cd openframe-oss-lib

# Add the original repository as upstream
git remote add upstream https://github.com/original-org/openframe-oss-lib.git
```

2. **Build and Verify Setup**

```bash
# Install dependencies and build
mvn clean install

# Run tests to verify everything works
mvn test

# Run code quality checks
mvn checkstyle:check
```

3. **IDE Configuration**

#### IntelliJ IDEA Setup
1. Open the project directory in IntelliJ
2. Install the Lombok plugin: `File > Settings > Plugins > Search for "Lombok"`
3. Enable annotation processing: `File > Settings > Build > Compiler > Annotation Processors ✓`
4. Import code style: Download and import [Google Java Style](https://github.com/google/styleguide/blob/gh-pages/intellij-java-google-style.xml)
5. Reload Maven dependencies: `Maven tool window > Reload`

#### Eclipse Setup
1. Install Lombok: Download `lombok.jar` and run `java -jar lombok.jar`
2. Install Google Style: `Help > Eclipse Marketplace > Search for "Google Java Format"`
3. Import the project as an existing Maven project

## 🔄 Development Workflow

### 1. Creating a New Feature

```bash
# Create and switch to a feature branch
git checkout -b feature/add-timezone-support

# Keep your branch updated with upstream
git fetch upstream
git rebase upstream/main
```

### 2. Making Changes

Follow our coding standards (detailed below) and ensure your changes:

- **Follow existing patterns** in the codebase
- **Include comprehensive tests** for new functionality
- **Update documentation** as needed
- **Maintain backward compatibility** when possible

### 3. Testing Your Changes

```bash
# Run all tests
mvn test

# Run tests with coverage
mvn jacoco:prepare-agent test jacoco:report

# Check code style
mvn checkstyle:check

# Run specific test class
mvn test -Dtest=LogEventTest

# Integration tests (if applicable)
mvn verify
```

### 4. Committing Changes

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Commit format: <type>(<scope>): <description>
git commit -m "feat(audit): add timezone field to LogEvent DTO"
git commit -m "fix(device): correct filter option serialization issue"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(audit): add unit tests for LogFilters"
```

#### Commit Types

- `feat` - New features
- `fix` - Bug fixes  
- `docs` - Documentation changes
- `style` - Code style changes (formatting, missing semi colons, etc)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Build process or auxiliary tool changes

### 5. Submitting a Pull Request

```bash
# Push your feature branch
git push origin feature/add-timezone-support

# Create a pull request on GitHub with:
# - Clear title following conventional commit format
# - Detailed description of changes
# - Link to any related issues
# - Screenshots/examples if applicable
```

## 📝 Code Style and Conventions

### Java Coding Standards

#### DTO Design Patterns

```java
// ✅ Correct DTO structure
@Data                    // Generates getters, setters, equals, hashCode, toString
@Builder                 // Enables builder pattern
@NoArgsConstructor      // Default constructor for serialization
@AllArgsConstructor     // All-args constructor for builder
@JsonInclude(JsonInclude.Include.NON_NULL) // Optional: exclude null fields from JSON
public class ExampleDto {
    
    /** Unique identifier for the entity */
    private String id;
    
    /** Human-readable name or label */
    private String name;
    
    /** Creation timestamp */
    private Instant createdAt;
    
    /** List of associated tags */
    private List<String> tags;
    
    /** Optional metadata map */
    private Map<String, String> metadata;
}
```

#### Inheritance Patterns

```java
// ✅ For DTOs that extend other DTOs
@Data
@SuperBuilder           // Use instead of @Builder for inheritance
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class ExtendedDto extends BaseDto<String> {
    
    /** Additional field specific to this DTO */
    private String specificField;
}
```

#### Validation Annotations

```java
// ✅ Include validation where appropriate
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidatedDto {
    
    @NotNull
    @NotBlank
    private String requiredField;
    
    @Email
    private String emailField;
    
    @Size(min = 1, max = 100)
    private List<String> limitedList;
    
    @Past
    private Instant pastTimestamp;
}
```

### Package Structure and Naming

```
com.openframe.api.dto/
├── GenericQueryResult.java          # Base query result
├── CountedGenericQueryResult.java   # Extended query result with counts
├── audit/                           # Audit and logging DTOs
│   ├── LogEvent.java
│   ├── LogDetails.java
│   ├── LogFilters.java
│   ├── LogFilterOptions.java
│   └── OrganizationFilterOption.java
└── device/                          # Device management DTOs
    ├── DeviceFilterOption.java
    ├── DeviceFilterOptions.java
    └── DeviceFilters.java
```

### Naming Conventions

- **Classes**: PascalCase (`LogEvent`, `DeviceFilterOptions`)
- **Fields**: camelCase (`toolEventId`, `createdAt`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PAGE_SIZE`)
- **Packages**: lowercase with dots (`com.openframe.api.dto.audit`)

### Documentation Standards

#### Class-Level Documentation

```java
/**
 * Represents a comprehensive audit event in the OpenFrame system.
 * 
 * <p>This DTO encapsulates all information related to a single audit event,
 * including metadata about the user, device, organization context, and the
 * specific action that was performed.</p>
 * 
 * <p>Example usage:</p>
 * <pre>{@code
 * LogEvent event = LogEvent.builder()
 *     .toolEventId("evt_123")
 *     .eventType("USER_LOGIN")
 *     .severity("INFO")
 *     .timestamp(Instant.now())
 *     .build();
 * }</pre>
 * 
 * @author Your Name
 * @since 1.0.0
 * @see LogDetails for additional event information
 * @see LogFilters for filtering capabilities
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogEvent {
    // Implementation
}
```

#### Field-Level Documentation

```java
/** Unique identifier for this log event, typically prefixed with 'evt_' */
private String toolEventId;

/** 
 * Type of event that occurred (e.g., LOGIN, LOGOUT, SECURITY_ALERT).
 * Should be one of the predefined event types in the system.
 */
private String eventType;

/** ISO 8601 timestamp indicating when the event occurred */
private Instant timestamp;

/** 
 * Severity level of the event.
 * Valid values: INFO, WARNING, ERROR, CRITICAL
 */
private String severity;
```

### Testing Standards

#### Unit Test Structure

```java
class LogEventTest {
    
    @Test
    @DisplayName("Should create LogEvent with all required fields")
    void shouldCreateLogEventWithRequiredFields() {
        // Given
        String eventId = "evt_123";
        String eventType = "USER_LOGIN";
        Instant timestamp = Instant.now();
        
        // When
        LogEvent event = LogEvent.builder()
            .toolEventId(eventId)
            .eventType(eventType)
            .timestamp(timestamp)
            .build();
        
        // Then
        assertThat(event.getToolEventId()).isEqualTo(eventId);
        assertThat(event.getEventType()).isEqualTo(eventType);
        assertThat(event.getTimestamp()).isEqualTo(timestamp);
    }
    
    @Test
    @DisplayName("Should handle null values gracefully")
    void shouldHandleNullValues() {
        // When & Then
        assertThatCode(() -> LogEvent.builder().build())
            .doesNotThrowAnyException();
    }
    
    @Test
    @DisplayName("Should serialize to JSON correctly")
    void shouldSerializeToJson() throws JsonProcessingException {
        // Given
        LogEvent event = LogEvent.builder()
            .toolEventId("evt_123")
            .eventType("USER_LOGIN")
            .build();
            
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        
        // When
        String json = mapper.writeValueAsString(event);
        
        // Then
        assertThat(json).contains("evt_123");
        assertThat(json).contains("USER_LOGIN");
    }
}
```

#### Test Naming Conventions

- Test classes: `ClassNameTest`
- Test methods: `should[ExpectedBehavior]When[StateUnderTest]`
- Use `@DisplayName` for readable test descriptions

## 📋 Pull Request Guidelines

### Before Submitting

**Checklist for all Pull Requests:**

- [ ] Code follows project style guidelines
- [ ] All tests pass (`mvn test`)
- [ ] Code coverage is maintained or improved
- [ ] New features include comprehensive unit tests
- [ ] Documentation is updated (README, JavaDoc, etc.)
- [ ] Commit messages follow conventional format
- [ ] No checkstyle violations (`mvn checkstyle:check`)
- [ ] Branch is up to date with main (`git rebase upstream/main`)
- [ ] No merge conflicts

### Pull Request Template

When creating a pull request, use this template:

```markdown
## Description
Brief description of the changes and why they were needed.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated (if applicable)
- [ ] Manual testing performed

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Related Issues
Closes #123
```

### Review Process

1. **Automated Checks**: All PRs must pass automated tests and code quality checks
2. **Code Review**: At least one maintainer must review and approve the changes
3. **Documentation Review**: Ensure all documentation is accurate and up-to-date
4. **Testing**: Verify that tests are comprehensive and all edge cases are covered

## 🐛 Bug Reports

When reporting bugs, please use our issue template and include:

### Bug Report Template

```markdown
**Describe the Bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Create a LogEvent with '...'
2. Call method '....'
3. See error

**Expected Behavior**
A clear description of what you expected to happen.

**Code Example**
```java
// Minimal code example that reproduces the issue
LogEvent event = LogEvent.builder()
    .toolEventId("test")
    .build();
// Error occurs here
```

**Environment**
- OS: [e.g., Windows 10, macOS 12.0, Ubuntu 20.04]
- Java Version: [e.g., Java 11, Java 17]
- Maven Version: [e.g., 3.8.1]
- Library Version: [e.g., 1.0.0]

**Additional Context**
Add any other context about the problem here.
```

## 💡 Feature Requests

For new features, please:

1. **Check existing issues** to avoid duplicates
2. **Provide clear use case** and business justification
3. **Include code examples** of how the feature would be used
4. **Consider backward compatibility** implications

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Code Example**
```java
// Example of how you'd like to use the new feature
DeviceFilter filter = DeviceFilter.builder()
    .newFeature("example")
    .build();
```

**Additional context**
Add any other context or screenshots about the feature request here.
```

## 🔧 Development Tips

### Common Issues and Solutions

#### Issue 1: Lombok Not Working

**Symptoms**: Compilation errors about missing getters/setters

**Solution**:
```bash
# Verify Lombok is in dependencies
mvn dependency:tree | grep lombok

# Ensure annotation processing is enabled in IDE
# IntelliJ: Settings > Build > Compiler > Annotation Processors ✓
```

#### Issue 2: Test Failures

**Symptoms**: Tests fail unexpectedly

**Debug Steps**:
```bash
# Run specific test with verbose output
mvn test -Dtest=LogEventTest -X

# Check for dependency conflicts
mvn dependency:analyze

# Clean and rebuild
mvn clean compile test
```

#### Issue 3: Checkstyle Violations

**Symptoms**: `mvn checkstyle:check` fails

**Solution**:
```bash
# Generate checkstyle report
mvn checkstyle:checkstyle

# View report at target/site/checkstyle.html
# Fix violations according to Google Java Style Guide
```

### Useful Maven Commands

```bash
# Quick build without tests
mvn clean compile -DskipTests

# Run tests with coverage report
mvn clean test jacoco:report

# Generate all project reports
mvn site

# Analyze dependencies for conflicts
mvn dependency:analyze

# Update version for release
mvn versions:set -DnewVersion=1.1.0

# Deploy snapshot to repository
mvn clean deploy
```

### IDE Productivity Tips

#### IntelliJ IDEA
- **Live Templates**: Create templates for common DTO patterns
- **Code Inspections**: Enable Lombok-specific inspections
- **File Watchers**: Auto-format on save
- **Maven Integration**: Use Maven tool window for dependency management

#### Eclipse
- **Code Templates**: Set up templates for Lombok annotations
- **Save Actions**: Configure automatic formatting
- **Maven Integration**: Use m2eclipse for dependency management

## 📚 Resources

### Documentation
- [Project README](README.md) - Project overview and quick start
- [User Getting Started Guide](docs/tutorials/user/getting-started.md) - Complete user setup guide
- [Developer Architecture Guide](docs/tutorials/dev/architecture-overview-dev.md) - Deep dive into system design
- [API Documentation](docs/dev/) - Detailed documentation for each DTO

### External Resources
- [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html) - Our coding style reference
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format
- [Lombok Documentation](https://projectlombok.org/) - Annotation reference
- [Maven Guide](https://maven.apache.org/guides/) - Build tool documentation

## 🤝 Community

### Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: Check our comprehensive guides first
- **Code Review**: Learn from existing pull request discussions

### Recognition

We appreciate all contributions! Contributors will be:

- **Recognized** in release notes
- **Listed** in project contributors
- **Invited** to join our maintainer team (for significant contributions)

## 📜 License

By contributing to this project, you agree that your contributions will be licensed under the same [Flamingo AI Unified License v1.0](LICENSE.md) as the project.

---

Thank you for contributing to OpenFrame OSS Library! Your contributions help make this project better for everyone. 🙏