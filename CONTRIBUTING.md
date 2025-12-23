# Contributing to OpenFrame OSS Library

Thank you for your interest in contributing to OpenFrame OSS Library! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Ways to Contribute

- **🐛 Bug Reports** - Help us identify and fix issues
- **💡 Feature Requests** - Suggest new capabilities  
- **📝 Documentation** - Improve guides and examples
- **🔧 Code Contributions** - Submit bug fixes and new features
- **🧪 Testing** - Add test coverage and quality improvements
- **💬 Community Support** - Help others in discussions

## 🚀 Getting Started

### 1. Development Setup

First, set up your development environment:

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Set up your development environment
./gradlew build

# Run tests to ensure everything works
./gradlew test
```

See our [Development Environment Setup](./docs/development/setup/environment.md) for detailed instructions.

### 2. Understanding the Codebase

Before contributing, familiarize yourself with:

- **[Architecture Overview](./docs/development/architecture/overview.md)** - System design and components
- **[API Documentation](./docs/reference/architecture/overview.md)** - Core APIs and DTOs
- **[Testing Guide](./docs/development/testing/overview.md)** - Testing strategies and tools

## 📋 Contribution Process

### For Bug Fixes and Features

1. **📋 Create an Issue**
   - Search existing issues first
   - Use issue templates when available
   - Provide clear reproduction steps for bugs
   - Describe the desired behavior for features

2. **🌿 Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b bugfix/issue-description
   ```

3. **💻 Make Changes**
   - Follow our coding standards (see below)
   - Add tests for new functionality
   - Update documentation as needed
   - Ensure all tests pass

4. **✅ Test Your Changes**
   ```bash
   # Run all tests
   ./gradlew test
   
   # Run integration tests
   ./gradlew integrationTest
   
   # Check code quality
   ./gradlew check
   ```

5. **📤 Submit a Pull Request**
   - Use the PR template
   - Link to related issues
   - Provide clear description of changes
   - Include screenshots/examples if applicable

### For Documentation

1. **📝 Documentation Changes**
   - Fork the repository
   - Make your documentation improvements
   - Test documentation builds locally
   - Submit a pull request

2. **📚 Content Guidelines**
   - Use clear, concise language
   - Include code examples where helpful
   - Follow existing formatting patterns
   - Update table of contents if needed

## 🎨 Code Standards

### Java Code Style

We follow **Google Java Style Guide** with these key points:

```java
// ✅ Good: Clear naming and structure
@Service
public class DeviceManagementService {
    
    private final DeviceRepository deviceRepository;
    private final EventPublisher eventPublisher;
    
    public DeviceManagementService(DeviceRepository deviceRepository, 
                                  EventPublisher eventPublisher) {
        this.deviceRepository = deviceRepository;
        this.eventPublisher = eventPublisher;
    }
    
    public Optional<DeviceResponse> findDevice(String deviceId) {
        return deviceRepository.findById(deviceId)
                .map(this::mapToResponse);
    }
}
```

### Code Quality Requirements

- **✅ Test Coverage** - Minimum 80% line coverage for new code
- **✅ Documentation** - Javadoc for all public APIs
- **✅ Validation** - Input validation on all public methods
- **✅ Error Handling** - Proper exception handling and logging
- **✅ Security** - No hardcoded secrets or SQL injection vulnerabilities

### Commit Messages

Use conventional commit format:

```bash
# Format
<type>(<scope>): <description>

# Examples
feat(api): add device filtering by organization
fix(auth): resolve JWT token validation issue  
docs(readme): update quick start guide
test(device): add integration tests for device creation
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix  
- `docs` - Documentation changes
- `test` - Test additions or modifications
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `chore` - Build/tooling changes

### Branch Naming

```bash
# Feature branches
feature/device-health-monitoring
feature/oauth-integration

# Bug fix branches  
bugfix/device-query-performance
bugfix/auth-token-expiry

# Documentation branches
docs/api-reference-update
docs/contributing-guide
```

## 🧪 Testing Guidelines

### Test Types

| Test Type | Purpose | Coverage |
|-----------|---------|----------|
| **Unit Tests** | Test individual components | All public methods |
| **Integration Tests** | Test component interactions | Service layer |
| **Repository Tests** | Test data access layer | Database operations |
| **Contract Tests** | Test API contracts | External interfaces |

### Writing Good Tests

```java
// ✅ Good: Clear, focused test
@Test
@DisplayName("Should return device when valid ID provided")
void shouldReturnDeviceWhenValidIdProvided() {
    // Given
    String deviceId = "device-123";
    Device device = createTestDevice(deviceId);
    when(deviceRepository.findById(deviceId)).thenReturn(Optional.of(device));
    
    // When
    Optional<DeviceResponse> result = deviceService.findDevice(deviceId);
    
    // Then
    assertThat(result)
        .isPresent()
        .get()
        .extracting(DeviceResponse::getId)
        .isEqualTo(deviceId);
}
```

### Test Requirements

- **✅ Descriptive Names** - Test method names should describe the scenario
- **✅ AAA Pattern** - Arrange, Act, Assert structure
- **✅ Edge Cases** - Test both success and failure scenarios  
- **✅ Mock External Dependencies** - Use mocks for external services
- **✅ Clean Test Data** - Use test builders and factories

## 📝 Documentation Standards

### Code Documentation

```java
/**
 * Service for managing device lifecycle and operations.
 * 
 * <p>This service provides CRUD operations for devices and handles
 * device state transitions, health monitoring, and audit logging.
 * 
 * @author OpenFrame Team
 * @since 1.0.0
 */
@Service
public class DeviceManagementService {
    
    /**
     * Retrieves a device by its unique identifier.
     * 
     * @param deviceId the unique device identifier
     * @return device response if found, empty optional otherwise
     * @throws IllegalArgumentException if deviceId is null or blank
     */
    public Optional<DeviceResponse> findDevice(String deviceId) {
        // Implementation
    }
}
```

### Markdown Documentation

- Use clear headings and structure
- Include code examples for complex concepts
- Link to related documentation
- Keep line length under 100 characters
- Use tables for structured information

## 🔍 Code Review Process

### For Contributors

1. **📋 Self Review**
   - Review your own code before submitting
   - Check for typos and formatting issues
   - Ensure tests pass and coverage is adequate
   - Verify documentation is updated

2. **👥 Peer Review**
   - Address review comments promptly
   - Ask questions if feedback is unclear
   - Make requested changes or explain why not
   - Re-request review after making changes

### For Reviewers

1. **🎯 Review Focus Areas**
   - Code correctness and logic
   - Test coverage and quality
   - Documentation completeness
   - Security considerations
   - Performance implications

2. **💬 Feedback Guidelines**
   - Be constructive and specific
   - Explain the "why" behind suggestions
   - Acknowledge good practices
   - Ask questions rather than make demands
   - Focus on the code, not the person

## 🏷️ Issue Labels

We use labels to organize and prioritize issues:

### Type Labels
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to docs
- `question` - Further information is requested

### Priority Labels  
- `priority: high` - Critical issues affecting functionality
- `priority: medium` - Important improvements
- `priority: low` - Nice-to-have features

### Status Labels
- `status: pending` - Waiting for more information
- `status: in-progress` - Currently being worked on
- `status: review` - Ready for review
- `status: blocked` - Cannot proceed due to dependencies

### Component Labels
- `component: api` - API DTOs and interfaces
- `component: data` - Data models and repositories  
- `component: security` - Authentication and authorization
- `component: config` - Configuration and setup

## 🚦 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0) - Breaking changes
- **MINOR** (1.1.0) - New features, backwards compatible
- **PATCH** (1.1.1) - Bug fixes, backwards compatible

### Release Criteria

Before releasing a new version:
- ✅ All tests pass
- ✅ Documentation is updated
- ✅ Security review completed
- ✅ Performance benchmarks met
- ✅ Breaking changes documented

## 🆘 Getting Help

### For Contributors

- 💬 **GitHub Discussions** - Ask questions and get help
- 📧 **Email** - dev@openframe.io for private inquiries
- 📖 **Documentation** - Check existing docs first
- 🐛 **Issues** - Search existing issues for similar problems

### For Maintainers

- 📋 **Triage Issues** - Label and prioritize new issues
- 👥 **Review PRs** - Provide timely, constructive feedback  
- 📖 **Update Documentation** - Keep guides current
- 🎯 **Plan Releases** - Coordinate release planning

## 📜 Code of Conduct

### Our Standards

- **✅ Be Respectful** - Treat everyone with respect and kindness
- **✅ Be Inclusive** - Welcome developers of all skill levels
- **✅ Be Constructive** - Provide helpful, actionable feedback
- **✅ Be Patient** - Remember that we're all learning
- **✅ Be Professional** - Maintain a professional tone in all interactions

### Unacceptable Behavior

- ❌ Harassment or discrimination
- ❌ Offensive or inappropriate language
- ❌ Personal attacks or trolling
- ❌ Spam or off-topic content
- ❌ Sharing private information without consent

### Enforcement

Violations of our code of conduct should be reported to conduct@openframe.io. All reports will be investigated and appropriate action will be taken.

## 🙏 Recognition

### Contributors

We value all contributions and recognize contributors through:

- 🏆 **Contributor Recognition** - Credits in release notes
- 📊 **GitHub Profile** - Contribution graphs and statistics  
- 🎖️ **Special Mentions** - Highlighting significant contributions
- 💫 **Contributor Badge** - Special badge for regular contributors

### Types of Recognition

- **🐛 Bug Hunters** - Finding and reporting bugs
- **🚀 Feature Champions** - Implementing new capabilities
- **📚 Documentation Masters** - Improving guides and examples
- **🧪 Testing Heroes** - Adding comprehensive test coverage
- **💬 Community Leaders** - Helping others in discussions

## 📋 Checklist

Before submitting your contribution:

### Code Changes
- [ ] Code follows style guidelines
- [ ] Tests are added/updated and passing
- [ ] Documentation is updated
- [ ] Commit messages follow conventional format
- [ ] No merge conflicts with main branch
- [ ] Security considerations addressed

### Pull Request
- [ ] PR title is clear and descriptive
- [ ] PR description explains the changes
- [ ] Related issues are linked
- [ ] Screenshots/examples included if applicable
- [ ] Breaking changes are documented
- [ ] Reviewers are assigned

## 🎯 What's Next?

Ready to contribute? Here are some good first steps:

1. **🔍 Browse Issues** - Look for `good first issue` labels
2. **📖 Read Documentation** - Familiarize yourself with the architecture
3. **🚀 Set Up Development** - Follow the environment setup guide
4. **💬 Join Discussions** - Introduce yourself in GitHub discussions
5. **🤝 Find a Mentor** - Reach out to maintainers for guidance

Thank you for contributing to OpenFrame OSS Library! Together, we're building the future of device management platforms. 🚀

---

*For questions about contributing, please reach out to our team at dev@openframe.io or start a discussion on GitHub.*