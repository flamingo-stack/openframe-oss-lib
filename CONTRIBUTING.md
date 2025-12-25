# Contributing to OpenFrame OSS Library

Thank you for your interest in contributing to the OpenFrame OSS Library! We welcome contributions from developers of all skill levels. This guide will help you get started with contributing to our open-source project.

## 🚀 Getting Started

### Prerequisites

Before you begin contributing, ensure you have the following installed:

- **Java 21** or higher
- **Maven 3.6+** 
- **Git**
- **Docker & Docker Compose** (for local development)
- **IDE** (IntelliJ IDEA or VS Code recommended)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/openframe-oss-lib.git
   cd openframe-oss-lib
   ```

2. **Set up Local Environment**
   ```bash
   # Start required services
   docker-compose up -d mongodb redis kafka
   
   # Install dependencies
   mvn clean install
   ```

3. **Verify Setup**
   ```bash
   mvn test
   ```

For detailed setup instructions, see our [Development Documentation](./docs/development/setup/environment.md).

## 🏗️ Project Structure

```
openframe-oss-lib/
├── openframe-api-lib/              # Core API DTOs and interfaces
├── openframe-core/                 # Shared utilities and validation
├── openframe-security-core/        # JWT and OAuth2 infrastructure
├── openframe-data-mongo/          # MongoDB models and repositories
├── openframe-api-service-core/     # Main API implementation
├── openframe-client-core/          # Agent and client management
├── sdk/                           # Integration SDKs
│   ├── fleetmdm/                  # FleetDM integration
│   └── tacticalrmm/               # Tactical RMM integration
└── docs/                          # Documentation
```

## 🎯 How to Contribute

### Types of Contributions

We welcome several types of contributions:

- **🐛 Bug Fixes** - Help us squash bugs and improve stability
- **✨ New Features** - Add new capabilities to the library
- **📚 Documentation** - Improve guides, examples, and API documentation
- **🧪 Tests** - Expand test coverage and improve test quality
- **🏗️ Architecture** - Propose architectural improvements
- **🔧 Tools & CI/CD** - Enhance development workflows

### Contribution Workflow

1. **Choose an Issue**
   - Browse [open issues](https://github.com/flamingo-stack/openframe-oss-lib/issues)
   - Look for `good first issue` or `help wanted` labels
   - Comment on the issue to let others know you're working on it

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```

3. **Make Your Changes**
   - Follow our [coding standards](#coding-standards)
   - Write tests for new functionality
   - Update documentation as needed

4. **Test Your Changes**
   ```bash
   # Run unit tests
   mvn test
   
   # Run integration tests
   mvn verify -P integration-tests
   
   # Check code quality
   mvn spotbugs:check checkstyle:check
   ```

5. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add device health monitoring API"
   ```

6. **Push and Create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

   Then create a pull request on GitHub with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots/examples if applicable

## 📝 Coding Standards

### Java Code Style

We follow Google Java Style with some modifications:

```java
// ✅ Good - Clear naming and structure
@Service
public class DeviceManagementService {
    
    private static final Logger LOG = LoggerFactory.getLogger(DeviceManagementService.class);
    
    private final DeviceRepository deviceRepository;
    
    public DeviceManagementService(DeviceRepository deviceRepository) {
        this.deviceRepository = deviceRepository;
    }
    
    public PageResponse<DeviceResponse> findDevices(DeviceFilter filter) {
        LOG.debug("Finding devices with filter: {}", filter);
        // Implementation
    }
}
```

### Key Conventions

- **Class Names**: PascalCase (`DeviceService`, `OrganizationController`)
- **Method Names**: camelCase (`findDevices`, `createOrganization`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- **Package Names**: lowercase with dots (`com.openframe.api.service`)

### Documentation Requirements

- **Public APIs**: Must have Javadoc comments
- **Complex Logic**: Inline comments explaining approach
- **Configuration**: Document all configuration properties

```java
/**
 * Service for managing device operations including creation, updates, and queries.
 * Supports multi-tenant operations with proper data isolation.
 * 
 * @author Your Name
 * @since 1.0.0
 */
@Service
public class DeviceService {
    
    /**
     * Finds devices matching the provided filter criteria.
     *
     * @param filter The device filter criteria
     * @return Paginated list of devices matching the filter
     * @throws ValidationException if filter parameters are invalid
     */
    public PageResponse<DeviceResponse> findDevices(DeviceFilter filter) {
        // Implementation
    }
}
```

## 🧪 Testing Guidelines

### Test Structure

We use a comprehensive testing approach:

```
src/
├── test/java/                     # Unit tests
├── integration-test/java/         # Integration tests
└── e2e-test/java/                # End-to-end tests
```

### Writing Good Tests

```java
@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {
    
    @Mock
    private DeviceRepository deviceRepository;
    
    @InjectMocks
    private DeviceService deviceService;
    
    @Test
    @DisplayName("Should return paginated devices when valid filter provided")
    void shouldReturnPaginatedDevicesWhenValidFilter() {
        // Given
        DeviceFilter filter = DeviceFilter.builder()
            .organizationId("org-123")
            .status(DeviceStatus.ACTIVE)
            .build();
        
        // When
        PageResponse<DeviceResponse> result = deviceService.findDevices(filter);
        
        // Then
        assertThat(result.getData()).hasSize(2);
        assertThat(result.hasNextPage()).isFalse();
    }
}
```

### Test Categories

- **Unit Tests**: Fast, isolated tests for individual components
- **Integration Tests**: Test component interactions with real dependencies
- **E2E Tests**: Full workflow tests simulating real user scenarios

## 📋 Pull Request Guidelines

### PR Title Format

Use conventional commit format:

```
feat: add device health monitoring API
fix: resolve JWT token expiration issue
docs: update API documentation for events
test: add integration tests for organization service
```

### PR Description Template

```markdown
## Description
Brief description of the changes and why they were made.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots/Examples
<!-- If applicable, add screenshots or code examples -->

## Related Issues
Closes #123
```

### Review Process

1. **Automated Checks**: All CI/CD checks must pass
2. **Code Review**: At least one maintainer approval required
3. **Testing**: Verify test coverage meets minimum requirements (80%+)
4. **Documentation**: Ensure documentation is updated if needed

## 🐛 Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Environment details** (Java version, OS, etc.)
- **Steps to reproduce** the issue
- **Expected vs. actual behavior**
- **Error logs** or stack traces
- **Minimal code example** demonstrating the issue

### Feature Requests

For new features, provide:

- **Use case description** and business value
- **Proposed API/interface** if applicable
- **Implementation considerations**
- **Alternative solutions** considered

## 🏷️ Versioning and Releases

We follow [Semantic Versioning (SemVer)](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, backward compatible

### Release Process

1. Update version in `pom.xml`
2. Update `CHANGELOG.md`
3. Create release branch
4. Run full test suite
5. Create GitHub release with changelog

## 🤝 Community Guidelines

### Code of Conduct

- **Be respectful** and inclusive
- **Collaborate effectively** with other contributors  
- **Provide constructive feedback** in reviews
- **Help newcomers** get started

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community discussions
- **Discord/Slack**: Real-time collaboration and support

## 📚 Resources

### Development Resources

- [Development Setup Guide](./docs/development/setup/environment.md)
- [Architecture Overview](./docs/development/architecture/overview.md)
- [API Documentation](./docs/reference/architecture/overview.md)
- [Testing Guide](./docs/development/testing/overview.md)

### External Resources

- [Spring Boot Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [MongoDB Java Driver](https://mongodb.github.io/mongo-java-driver/)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)

## 🙋‍♂️ Getting Help

If you need help with contributing:

1. Check existing [documentation](./docs/README.md)
2. Search [GitHub Discussions](https://github.com/flamingo-stack/openframe-oss-lib/discussions)
3. Ask questions in our community channels
4. Reach out to maintainers in issues or discussions

## 🎉 Recognition

Contributors are recognized in several ways:

- **Contributors List**: Added to repository contributors
- **Release Notes**: Highlighted in release announcements  
- **Community Recognition**: Featured in community updates
- **Maintainer Opportunities**: Potential path to becoming a maintainer

---

Thank you for contributing to OpenFrame OSS Library! Together, we're building the future of open-source MSP platforms. 🚀

<div align="center">
  <a href="https://github.com/flamingo-stack/openframe-oss-lib/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=flamingo-stack/openframe-oss-lib" />
  </a>
</div>