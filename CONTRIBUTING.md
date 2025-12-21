# Contributing to OpenFrame OSS Library

Thank you for your interest in contributing to the OpenFrame OSS Library! This document provides guidelines and information for contributors.

## 🎯 How to Contribute

We welcome contributions in many forms:

- 🐛 **Bug Reports** - Help us identify and fix issues
- 💡 **Feature Requests** - Suggest new functionality
- 📝 **Documentation** - Improve guides and examples
- 🧪 **Testing** - Add test coverage and quality assurance
- 🔧 **Code Contributions** - Implement features and fixes

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Java 17 or higher** installed
- **Maven 3.8 or higher** configured
- **Git** for version control
- An **IDE** with Lombok plugin support (IntelliJ IDEA, Eclipse, VS Code)

### Development Environment Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/openframe-oss-lib.git
   cd openframe-oss-lib
   ```
3. **Install dependencies** and verify build:
   ```bash
   mvn clean compile
   mvn test
   ```
4. **Configure your IDE** with Lombok plugin and annotation processing enabled

For detailed setup instructions, see our [Environment Setup Guide](./docs/development/setup/environment.md).

## 📋 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 2. Make Your Changes

- Write clean, readable code following our style guidelines
- Add comprehensive tests for new functionality
- Update documentation as needed
- Ensure all tests pass locally

### 3. Test Your Changes

```bash
# Run all tests
mvn test

# Run tests with coverage
mvn test jacoco:report

# Check code style
mvn checkstyle:check
```

### 4. Commit Your Changes

Follow conventional commit format:

```bash
git add .
git commit -m "feat: add new audit log filtering capability"
# or
git commit -m "fix: resolve device filter null pointer exception"
# or
git commit -m "docs: update API usage examples"
```

**Commit Message Format:**
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Test additions or modifications
- `refactor:` Code refactoring
- `style:` Formatting changes
- `chore:` Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title and description
- Reference any related issues
- Include screenshots/examples if applicable
- Ensure CI checks pass

## 🎨 Code Style Guidelines

### Java Code Standards

- **Java 17+ features** encouraged where appropriate
- **Lombok annotations** for reducing boilerplate
- **Builder pattern** for complex object creation
- **Immutable objects** where possible
- **Meaningful variable names** and clear method signatures

### Code Formatting

We use standard Java formatting with these preferences:
- **4 spaces** for indentation
- **120 character** line length limit
- **Google Java Style Guide** conventions

### Example Code Style

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogEvent {
    private String toolEventId;
    private String eventType;
    private String severity;
    private String userId;
    private String organizationName;
    private Instant timestamp;
    
    public boolean isHighSeverity() {
        return "ERROR".equals(severity) || "CRITICAL".equals(severity);
    }
}
```

## 🧪 Testing Guidelines

### Test Structure

- **Unit tests** for individual classes and methods
- **Integration tests** for module interactions
- **Builder tests** for complex object creation
- **Edge case coverage** for error conditions

### Test Naming Convention

```java
public class LogEventTest {
    
    @Test
    void shouldCreateLogEventWithBuilder() {
        // Test implementation
    }
    
    @Test
    void shouldThrowExceptionWhenEventTypeIsNull() {
        // Test implementation
    }
    
    @Test
    void shouldReturnTrueForHighSeverityEvents() {
        // Test implementation
    }
}
```

### Test Coverage Requirements

- **Minimum 90%** code coverage for new features
- **100%** coverage for critical business logic
- **Edge cases** and error conditions must be tested

## 📖 Documentation Standards

### Code Documentation

- **JavaDoc** for all public classes and methods
- **Inline comments** for complex business logic
- **README updates** for new features
- **Architecture documentation** for significant changes

### Documentation Format

```java
/**
 * Represents an audit log event within the OpenFrame system.
 * 
 * <p>This class encapsulates all information related to a single audit event,
 * including metadata about the user, organization, and event details.</p>
 * 
 * <p>Example usage:</p>
 * <pre>{@code
 * LogEvent event = LogEvent.builder()
 *     .toolEventId("evt-12345")
 *     .eventType("USER_LOGIN")
 *     .severity("INFO")
 *     .build();
 * }</pre>
 * 
 * @since 1.0.0
 * @see LogFilters
 */
@Data
@Builder
public class LogEvent {
    // Implementation
}
```

## 🔍 Pull Request Process

### Before Submitting

- [ ] All tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] Branch is up-to-date with main

### Pull Request Template

When creating a PR, please include:

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)

## Related Issues
Fixes #123, Closes #456
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **Code review** by maintainers
3. **Testing verification** for complex changes
4. **Documentation review** for user-facing changes
5. **Final approval** and merge

## 🐛 Issue Reporting

### Bug Reports

Please include:

- **Environment details** (Java version, OS, Maven version)
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Code samples** demonstrating the problem
- **Error messages** and stack traces

### Feature Requests

Please include:

- **Use case description** and motivation
- **Proposed solution** or implementation ideas
- **Alternative solutions** considered
- **Additional context** or examples

### Issue Labels

We use these labels to categorize issues:

- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `documentation` - Documentation needs
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `question` - Further information requested

## 🏆 Recognition

Contributors will be recognized in:

- **CONTRIBUTORS.md** file
- **Release notes** for significant contributions
- **GitHub contributor statistics**

## 📞 Getting Help

Need help getting started?

- **[Development Documentation](./docs/development/README.md)** - Comprehensive development guides
- **[GitHub Discussions](../../discussions)** - Ask questions and get help
- **[GitHub Issues](../../issues)** - Report bugs or suggest features

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- **Be respectful** and inclusive
- **Be collaborative** and constructive
- **Focus on what's best** for the community
- **Show empathy** towards other contributors

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (Flamingo AI Unified License v1.0).

---

Thank you for contributing to OpenFrame OSS Library! Together, we're building better tools for audit logging and device management. 🚀