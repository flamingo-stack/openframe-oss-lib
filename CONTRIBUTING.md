# Contributing to OpenFrame OSS Lib

Welcome! Thank you for your interest in contributing to OpenFrame OSS Lib. This guide will help you understand how to contribute effectively to the foundational API DTO library that powers the OpenFrame platform.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Code Guidelines](#code-guidelines)
- [Contribution Workflow](#contribution-workflow)
- [Testing Requirements](#testing-requirements)
- [Review Process](#review-process)
- [Community Guidelines](#community-guidelines)

## Getting Started

### Before You Contribute

1. **Join the Community**: Connect with contributors on [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
2. **Understand the Project**: Read the [README.md](README.md) and review the architecture documentation
3. **Set Up Your Environment**: Follow the development setup guide below

### Types of Contributions

| Contribution Type | Description | Requirements |
|------------------|-------------|--------------|
| **🐛 Bug Fixes** | Fix issues in existing DTOs | Unit tests + code review |
| **✨ New DTOs** | Add new data transfer objects | Architecture review + comprehensive tests |
| **📚 Documentation** | Improve docs and examples | Documentation review |
| **🧪 Test Coverage** | Add or improve tests | Code review |
| **⚡ Performance** | Optimize serialization/memory | Performance benchmarks + review |
| **🔐 Security** | Security improvements | Security review + thorough testing |

## Development Environment

### Prerequisites

```bash
# Required tools
java -version    # Java 8+ required
mvn -version     # Maven 3.6+ required
git --version    # Git for version control
```

### Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR-USERNAME/openframe-oss-lib.git
cd openframe-oss-lib

# 2. Add upstream remote
git remote add upstream https://github.com/openframe/openframe-oss-lib.git

# 3. Verify setup
mvn clean compile test
```

### IDE Configuration

#### IntelliJ IDEA
1. Install **Lombok Plugin**: `File > Settings > Plugins > Lombok`
2. Enable **Annotation Processing**: `File > Settings > Build > Annotation Processors`
3. Import **Code Style**: Use Google Java Style with 4-space indentation

#### Eclipse
1. Install Lombok: Download `lombok.jar` and run installer
2. Import project as Maven project
3. Configure formatter for Google Java Style

## Code Guidelines

### Java Code Style

OpenFrame OSS Lib follows **Google Java Style** with specific adaptations:

```java
// ✅ Proper DTO structure
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExampleDTO {
    
    // Field order: IDs, primary data, metadata, relationships
    private String id;
    private String organizationId;
    private String name;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<String> relatedIds;
    
    /**
     * Validates that the DTO contains required fields.
     * 
     * @throws ValidationException if validation fails
     */
    public void validate() {
        if (id == null || id.trim().isEmpty()) {
            throw new ValidationException("ID is required");
        }
    }
}
```

### Key Style Rules

- **Indentation**: 4 spaces (no tabs)
- **Line Length**: 120 characters maximum
- **Braces**: Opening brace on same line
- **Imports**: Organized (java.*, javax.*, org.*, com.*)
- **JavaDoc**: Required for all public APIs

### Lombok Conventions

Follow consistent Lombok patterns:

```java
// ✅ Standard pattern for all DTOs
@Data                    // getters, setters, toString, equals, hashCode
@Builder                 // builder pattern
@NoArgsConstructor       // default constructor (Jackson/JPA)
@AllArgsConstructor      // all-args constructor
public class StandardDTO {
    // Implementation...
}
```

### Naming Conventions

#### Class Names
```java
// ✅ Descriptive and clear
LogEvent                 // Clear purpose
DeviceFilterCriteria     // Describes functionality
AuditLogDetails         // Specific to domain
```

#### Field Names
```java
// ✅ Consistent patterns
private String id;              // Primary ID
private String organizationId;  // Always end with "Id"
private List<String> eventTypes;     // Plural for collections
private LocalDateTime createdAt;     // Clear temporal intent
```

## Contribution Workflow

### Branch Naming

Use descriptive branch names that indicate the type and scope:

```bash
# Feature branches
feature/add-device-configuration-dto
feature/improve-audit-filtering
feature/add-validation-helpers

# Bug fixes
bugfix/fix-null-serialization
bugfix/resolve-builder-inheritance
bugfix/correct-timezone-handling

# Documentation
docs/update-architecture-guide
docs/add-serialization-examples

# Performance improvements  
perf/optimize-json-performance
perf/reduce-memory-footprint
```

### Commit Message Format

Follow **Conventional Commits** specification:

```bash
# Format: <type>(<scope>): <description>

# Examples:
feat(audit): add LogDetails DTO for detailed audit events
fix(device): resolve null pointer in DeviceFilterCriteria
docs(readme): update quick start installation steps
test(integration): add JSON serialization tests
refactor(builder): improve builder pattern consistency
perf(serialization): optimize Jackson annotations
```

#### Commit Types

| Type | Description |
|------|-------------|
| `feat` | New feature or DTO |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `refactor` | Code improvement without functionality change |
| `perf` | Performance improvement |
| `style` | Code formatting/style |
| `ci` | CI/CD changes |

### Pull Request Process

#### 1. Prepare Your Changes

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat(scope): descriptive commit message"

# Push to your fork
git push origin feature/your-feature-name
```

#### 2. Submit Pull Request

Use this template:

```markdown
## Description
Brief description of what this PR does and why.

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change) 
- [ ] Breaking change
- [ ] Documentation update
- [ ] Test improvement

## Changes Made
- Added: List specific additions
- Modified: List changes to existing code
- Fixed: List bugs resolved

## Testing
- [ ] Added unit tests
- [ ] All existing tests pass
- [ ] Manual testing performed
- [ ] Integration tests added (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests prove fix/feature works

## Related Issues
Closes #(issue-number)
```

#### 3. Address Review Feedback

```bash
# Make requested changes
git add .
git commit -m "address review feedback: specific changes made"
git push origin feature/your-feature-name
```

## Testing Requirements

### Minimum Requirements

- **Unit Test Coverage**: Minimum 85% line coverage
- **Integration Tests**: For complex DTOs with relationships
- **Serialization Tests**: JSON round-trip testing for all DTOs
- **Validation Tests**: Test validation logic thoroughly

### Test Structure

```java
// ✅ Comprehensive test structure
@Test
class LogEventTest {
    
    @Test
    void shouldSerializeToJsonCorrectly() {
        // Given
        LogEvent event = LogEvent.builder()
            .id("test-id")
            .eventType("LOGIN")
            .timestamp(LocalDateTime.now())
            .build();
            
        // When
        String json = objectMapper.writeValueAsString(event);
        LogEvent deserialized = objectMapper.readValue(json, LogEvent.class);
        
        // Then
        assertThat(deserialized).isEqualTo(event);
    }
    
    @Test
    void shouldValidateRequiredFields() {
        // Given
        LogEvent event = LogEvent.builder().build();
        
        // When/Then
        assertThatThrownBy(() -> event.validate())
            .isInstanceOf(ValidationException.class)
            .hasMessageContaining("ID is required");
    }
    
    @Test
    void shouldBuildUsingBuilderPattern() {
        // Given/When
        LogEvent event = LogEvent.builder()
            .id("test-id")
            .organizationId("org-123")
            .eventType("DATA_EXPORT")
            .severity("HIGH")
            .build();
            
        // Then
        assertThat(event.getId()).isEqualTo("test-id");
        assertThat(event.getOrganizationId()).isEqualTo("org-123");
    }
}
```

### Running Tests

```bash
# Run all tests
mvn test

# Run tests with coverage
mvn test jacoco:report

# Run specific test class
mvn test -Dtest=LogEventTest

# Run tests with verbose output
mvn test -X
```

## Review Process

### Automated Checks

All PRs must pass:
- ✅ **Compilation**: Code compiles without errors
- ✅ **Tests**: All tests pass with minimum 85% coverage
- ✅ **Style**: Code style validation
- ✅ **Dependencies**: Security vulnerability scanning

### Manual Review

PRs are reviewed for:

#### Code Quality
- [ ] Follows project conventions
- [ ] Proper Lombok usage
- [ ] Clear, descriptive naming
- [ ] Appropriate JavaDoc
- [ ] Error handling

#### Architecture Compliance
- [ ] Contract-first design
- [ ] Multi-tenancy support where needed
- [ ] Proper generic usage
- [ ] Consistent builder patterns
- [ ] Jackson compatibility

#### Security
- [ ] No sensitive data in DTOs
- [ ] Proper input validation
- [ ] Organization isolation maintained
- [ ] No information leakage

### Review Timeline

- **Simple Changes**: 1-2 business days
- **New Features**: 3-5 business days  
- **Breaking Changes**: Architectural review required

## Community Guidelines

### Code of Conduct

- **Be Respectful**: Treat everyone with kindness and respect
- **Be Constructive**: Provide helpful, actionable feedback
- **Be Collaborative**: Work together to improve the project
- **Be Patient**: Everyone has different experience levels

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub PRs**: Code-specific discussions
- **OpenMSP Slack**: Real-time collaboration and support
  - Channel: `#openframe-development`
  - General: `#general`

### Getting Help

1. **Check Documentation**: Start with existing docs and examples
2. **Search Issues**: Look for similar problems or questions
3. **Ask in Slack**: Get help from the community
4. **Create Issue**: For bugs or feature requests

### Recognition

Contributors are recognized through:
- **Contributors Page**: GitHub contributors list
- **Release Notes**: Acknowledgment in release notes
- **Hall of Fame**: Special recognition for significant contributions

## Development Best Practices

### Before Starting

- [ ] **Discuss Large Changes**: Create an issue for significant features
- [ ] **Check Existing Work**: Ensure you're not duplicating effort
- [ ] **Understand Impact**: Consider how changes affect existing code

### During Development

- [ ] **Write Tests First**: TDD approach recommended
- [ ] **Keep Changes Focused**: One logical change per PR
- [ ] **Update Documentation**: Keep docs current with code changes
- [ ] **Test Thoroughly**: Test edge cases and error conditions

### Before Submitting

- [ ] **Self-Review**: Thoroughly review your own code
- [ ] **Clean Commit History**: Squash or organize commits logically
- [ ] **Update Dependencies**: Ensure dependencies are current
- [ ] **Test Integration**: Verify changes work with existing code

## Release Process

For maintainers preparing releases:

### Version Strategy
OpenFrame OSS Lib follows **Semantic Versioning**:
- `MAJOR.MINOR.PATCH`
- Major: Breaking changes
- Minor: New features, backward-compatible
- Patch: Bug fixes

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in `pom.xml`
- [ ] Git tag created
- [ ] Maven artifacts published
- [ ] GitHub release with notes

## Summary

Contributing to OpenFrame OSS Lib:

1. **Setup**: Follow development environment setup
2. **Code**: Adhere to style guidelines and conventions  
3. **Test**: Write comprehensive tests with good coverage
4. **Document**: Keep documentation current and helpful
5. **Collaborate**: Use the PR process effectively and be responsive to feedback

Your contributions help power the OpenFrame platform that enables AI-driven MSP solutions worldwide!

## Questions?

- 💬 **Slack**: [OpenMSP Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- 🐛 **Issues**: [GitHub Issues](https://github.com/openframe/openframe-oss-lib/issues)
- 📧 **Email**: For sensitive topics, reach out to the maintainers

---

*Thank you for contributing to OpenFrame OSS Lib! Every contribution, no matter how small, makes a difference in building better AI-powered MSP solutions.*