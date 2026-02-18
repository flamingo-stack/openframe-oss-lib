# Contributing to OpenFrame OSS Lib

Welcome to the OpenFrame OSS Lib contributor community! This guide provides comprehensive information about contributing to the project, from code standards to submission processes.

## 🤝 Community Guidelines

OpenFrame OSS Lib follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). By participating, you agree to uphold this code.

**Key Principles:**
- 🤝 **Be respectful** and inclusive in all interactions
- 🔍 **Be thorough** in code reviews and testing
- 📚 **Document your changes** clearly and comprehensively
- 🛡️ **Prioritize security** in all contributions
- 🧪 **Test everything** - no untested code gets merged

## 🚀 Getting Started

### Prerequisites for Contributors

Before contributing, ensure you have:

- ✅ **Development environment** set up ([Environment Setup](./docs/development/setup/environment.md))
- ✅ **Local development stack** running ([Local Development](./docs/development/setup/local-development.md))
- ✅ **Architecture understanding** ([Architecture Overview](./docs/development/architecture/README.md))
- ✅ **Testing knowledge** ([Testing Guide](./docs/development/testing/README.md))
- ✅ **Security awareness** ([Security Best Practices](./docs/development/security/README.md))

### Setting Up Your Contribution

```bash
# Fork the repository on GitHub
# Clone your fork locally
git clone https://github.com/YOUR_USERNAME/openframe-oss-lib.git
cd openframe-oss-lib

# Add upstream remote
git remote add upstream https://github.com/flamingo-stack/openframe-oss-lib.git

# Create a feature branch
git checkout -b feature/your-feature-name

# Verify build works
mvn clean install -DskipTests
```

## 🌳 Branch Naming Convention

Use descriptive branch names following this pattern:

```text
<type>/<short-description>

Types:
- feature/    - New features or enhancements
- fix/        - Bug fixes
- security/   - Security improvements
- refactor/   - Code refactoring without functional changes
- docs/       - Documentation updates
- test/       - Test additions or improvements
- chore/      - Maintenance tasks (dependencies, build, etc.)

Examples:
- feature/multi-tenant-api-keys
- fix/cursor-pagination-edge-case
- security/improve-jwt-validation
- refactor/service-layer-cleanup
- docs/update-security-guide
```

## 📝 Commit Standards

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code formatting (no logic changes)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or modifications
- `chore`: Maintenance tasks
- `security`: Security improvements

**Examples:**

```bash
# Feature addition
git commit -m "feat(api-service): add cursor-based pagination for devices

- Implement CursorPaginationInput and CursorPageInfo DTOs
- Add pagination logic to DeviceRepository
- Update GraphQL schema with cursor pagination
- Include comprehensive test coverage

Closes #123"

# Security fix
git commit -m "fix(security): prevent JWT token replay attacks

- Add jti (JWT ID) claim to all tokens
- Implement token blacklist using Redis
- Update validation logic to check blacklist
- Add security tests for token replay scenarios

Security impact: Prevents token reuse after logout
Fixes #456"
```

## 🏗️ Code Quality Standards

### Java Code Style

Follow the established patterns in the codebase:

```java
// ✅ Good: Proper class structure with validation
@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
@Slf4j
@Validated
public class DeviceController {
    
    private final DeviceService deviceService;
    
    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'USER')")
    public ResponseEntity<DeviceResponse> createDevice(
        @Valid @RequestBody CreateDeviceRequest request,
        @AuthenticationPrincipal AuthPrincipal principal
    ) {
        log.info("Creating device for tenant: {}", principal.getTenantId());
        
        DeviceResponse device = deviceService.create(request, principal.getTenantId());
        
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(device);
    }
}
```

### Security Implementation

All new endpoints must implement proper security:

```java
// ✅ Good: Comprehensive security implementation
@RestController
@RequestMapping("/api/organizations")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class OrganizationController {
    
    @GetMapping("/{id}")
    @PreAuthorize("hasPermission(#id, 'Organization', 'READ')")
    public ResponseEntity<OrganizationResponse> getOrganization(
        @PathVariable String id,
        @AuthenticationPrincipal AuthPrincipal principal
    ) {
        // Service layer enforces tenant isolation
        OrganizationResponse org = organizationService.findById(id, principal.getTenantId());
        return ResponseEntity.ok(org);
    }
}
```

### Repository Patterns

Always implement tenant isolation at the repository level:

```java
// ✅ Good: Tenant-scoped repository methods
@Repository
public interface DeviceRepository extends MongoRepository<Device, String> {
    
    @Query("{ 'tenantId': ?0, 'status': ?1 }")
    Page<Device> findByTenantIdAndStatus(
        String tenantId, 
        DeviceStatus status, 
        Pageable pageable
    );
    
    @Query("{ 'tenantId': ?0, '_id': { '$gt': ?1 } }")
    List<Device> findByTenantIdAfterCursor(
        String tenantId,
        String cursor,
        Pageable pageable
    );
    
    boolean existsByNameAndTenantId(String name, String tenantId);
}
```

## 🧪 Testing Requirements

### Test Coverage Requirements

All contributions must maintain or improve test coverage:

- **Unit tests**: 85%+ line coverage for new code
- **Integration tests**: Cover all new API endpoints
- **Security tests**: Test all authentication and authorization paths
- **Performance tests**: For performance-critical changes

### Test Implementation Example

```java
@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {
    
    @Mock
    private DeviceRepository deviceRepository;
    
    @Mock
    private EventPublisher eventPublisher;
    
    @InjectMocks
    private DeviceService deviceService;
    
    @Test
    @DisplayName("Should create device with valid request")
    void shouldCreateDeviceWithValidRequest() {
        // Given
        String tenantId = "tenant-123";
        CreateDeviceRequest request = CreateDeviceRequest.builder()
            .name("Test Device")
            .type(DeviceType.LAPTOP)
            .build();
            
        Device savedDevice = Device.builder()
            .id("device-123")
            .tenantId(tenantId)
            .name("Test Device")
            .type(DeviceType.LAPTOP)
            .status(DeviceStatus.ACTIVE)
            .build();
            
        when(deviceRepository.save(any(Device.class))).thenReturn(savedDevice);
        when(deviceRepository.existsByNameAndTenantId("Test Device", tenantId)).thenReturn(false);
        
        // When
        DeviceResponse result = deviceService.create(request, tenantId);
        
        // Then
        assertThat(result.getId()).isEqualTo("device-123");
        assertThat(result.getName()).isEqualTo("Test Device");
        assertThat(result.getType()).isEqualTo(DeviceType.LAPTOP);
        
        verify(deviceRepository).save(argThat(device ->
            device.getTenantId().equals(tenantId) &&
            device.getName().equals("Test Device")
        ));
        
        verify(eventPublisher).publishEvent(any(DeviceCreatedEvent.class));
    }
}
```

## 📖 Documentation Requirements

### Code Documentation

All public APIs must be thoroughly documented:

```java
/**
 * Creates a new device for the specified tenant.
 * 
 * <p>This method validates the device creation request, ensures the device name
 * is unique within the tenant scope, and publishes a domain event upon successful
 * creation.</p>
 * 
 * @param request the device creation request containing device details
 * @param tenantId the ID of the tenant creating the device (must not be null)
 * @return DeviceResponse containing the created device details
 * @throws DuplicateDeviceNameException if a device with the same name already exists
 * @throws IllegalArgumentException if the request is invalid
 * @throws TenantNotFoundException if the specified tenant does not exist
 * 
 * @since 5.30.0
 */
@Transactional
public DeviceResponse create(CreateDeviceRequest request, String tenantId) {
    // Implementation...
}
```

## 📋 Pull Request Process

### Pre-Submission Checklist

Before submitting a pull request, ensure:

- [ ] **All tests pass** locally and in CI
- [ ] **Code coverage** meets minimum requirements (85% for new code)
- [ ] **Security tests** are included for security-related changes
- [ ] **Documentation** is updated for API changes
- [ ] **Commit messages** follow conventional format
- [ ] **Branch** is up-to-date with main/develop
- [ ] **No merge conflicts** exist

### Pull Request Template

Use this template for all pull requests:

```markdown
## Description

Brief description of the changes and their purpose.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Security improvement
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring (no functional changes)

## Related Issues

Closes #(issue_number)
Fixes #(issue_number)
Refs #(issue_number)

## Testing

### Test Coverage

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Security tests added/updated
- [ ] Performance tests added/updated (if applicable)

## Security Impact (if applicable)

- **Authentication changes**: Describe authentication modifications
- **Authorization changes**: Describe permission modifications
- **Data access changes**: Describe data isolation modifications
- **Security vulnerability fixes**: Reference CVE or security issue

## Reviewer Notes

Additional context for reviewers, including:
- Areas that need special attention
- Potential concerns or trade-offs
- Design decisions and their rationale
```

### Review Process

All PRs undergo automated validation:

- ✅ Build success (`mvn clean install`)
- ✅ Test success (unit + integration tests)
- ✅ Code quality (Checkstyle, SpotBugs)
- ✅ Security scan (dependency vulnerabilities)
- ✅ Documentation build (if docs changed)

Reviewers will evaluate:

1. **Code Quality** - Follows established patterns and conventions
2. **Security** - Proper authentication, authorization, and tenant isolation
3. **Testing** - Adequate test coverage with meaningful tests
4. **Documentation** - Code is properly documented with updated specs
5. **Performance** - No regressions with efficient implementation

## 🔒 Special Contribution Types

### Security Contributions

Security-related contributions require:

1. **Private disclosure** for security vulnerabilities
2. **Security impact assessment** in PR description
3. **Security test requirements** - comprehensive test coverage
4. **Security review** by designated security maintainers

### Performance Contributions

Performance improvements require:

1. **Benchmark results** showing improvement
2. **Performance tests** to prevent regression
3. **Memory usage analysis** for significant changes
4. **Load testing results** for critical path changes

### Breaking Changes

Breaking changes require:

1. **Version bump** consideration (semantic versioning)
2. **Migration guide** for users
3. **Deprecation notices** in previous versions (if possible)
4. **Extended documentation** explaining the change

## 💬 Community Interaction

### Getting Help

- **Community Slack**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **Documentation**: [Complete Documentation](./docs/README.md)
- **Architecture Guide**: [System Design and Patterns](./docs/development/architecture/README.md)

> **Note**: We use the OpenMSP Slack community for all discussions, issues, and collaboration. GitHub Issues and Discussions are not actively monitored.

### Code Review Etiquette

**As a reviewer:**
- ✅ Be constructive and respectful
- ✅ Explain the "why" behind your suggestions
- ✅ Recognize good work and improvements
- ✅ Focus on code, not the person

**As a contributor:**
- ✅ Be open to feedback
- ✅ Ask for clarification when needed
- ✅ Respond promptly to review comments
- ✅ Thank reviewers for their time

## 🏆 Recognition

Contributors are recognized through:

- **Contributor list** in project README
- **Release notes** mentioning significant contributions
- **Community highlights** in project communications
- **Maintainer opportunities** for consistent contributors

## 📚 Resources

### Essential Reading
- **[Architecture Overview](./docs/development/architecture/README.md)** - System design and patterns
- **[Security Best Practices](./docs/development/security/README.md)** - Security implementation
- **[Testing Guide](./docs/development/testing/README.md)** - Testing strategies and tools

### Development Tools
- **IntelliJ IDEA** with Spring Boot and Lombok plugins
- **Docker** for development environment
- **MongoDB Compass** for database management
- **Redis CLI** for cache inspection

### Community
- **Slack**: [OpenMSP Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **GitHub**: [OpenFrame OSS Lib Repository](https://github.com/flamingo-stack/openframe-oss-lib)
- **Website**: [flamingo.run](https://flamingo.run) | [openframe.ai](https://openframe.ai)

---

Thank you for contributing to OpenFrame OSS Lib! Your contributions help build the future of open-source MSP platforms and intelligent IT automation systems.

**Ready to get started?** Join the [OpenMSP Slack community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) and introduce yourself!