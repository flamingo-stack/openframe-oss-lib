# Contributing Guidelines

Welcome to the OpenFrame OSS Lib community! This guide outlines the standards, processes, and best practices for contributing to the project. Whether you're fixing bugs, adding features, or improving documentation, following these guidelines ensures a smooth collaboration experience.

## Getting Started

### Before You Begin

1. **Join the Community**: Connect with us on [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) for discussions and support
2. **Review the Architecture**: Read the [Architecture Overview](../architecture/README.md) to understand the system design
3. **Set Up Your Environment**: Follow the [Development Environment Setup](../setup/environment.md) guide
4. **Run the Project Locally**: Complete the [Local Development Guide](../setup/local-development.md)

### Types of Contributions

We welcome various types of contributions:

- 🐛 **Bug fixes** - Resolve issues and improve stability
- ✨ **New features** - Add functionality that benefits the community
- 📚 **Documentation** - Improve guides, API docs, and examples
- 🧪 **Tests** - Add test coverage and improve test reliability
- 🔧 **Refactoring** - Improve code quality and maintainability
- 🔐 **Security** - Address security vulnerabilities and improve security posture

## Code Standards & Style

### Java Code Style

OpenFrame follows established Java conventions with specific guidelines:

#### General Principles

```java
// ✅ GOOD: Clear, descriptive naming
@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceManagementService {
    
    private final DeviceRepository deviceRepository;
    private final OrganizationService organizationService;
    private final ApplicationEventPublisher eventPublisher;
    
    public Device createDevice(CreateDeviceRequest request, AuthPrincipal principal) {
        log.debug("Creating device '{}' for tenant '{}'", 
                 request.getName(), principal.getTenantId());
        
        validateDeviceCreation(request, principal);
        
        Device device = buildDevice(request, principal);
        Device savedDevice = deviceRepository.save(device);
        
        publishDeviceCreatedEvent(savedDevice);
        
        return savedDevice;
    }
}

// ❌ BAD: Poor naming, no structure
@Service
public class DeviceService {
    @Autowired DeviceRepository repo;
    
    public Device create(CreateDeviceRequest req, AuthPrincipal p) {
        Device d = new Device();
        d.setName(req.getName());
        d.setTenantId(p.getTenantId());
        return repo.save(d);
    }
}
```

#### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| **Classes** | PascalCase, descriptive | `DeviceManagementService`, `JwtAuthenticationFilter` |
| **Methods** | camelCase, verb-based | `createDevice()`, `validateUserAccess()` |
| **Variables** | camelCase, noun-based | `deviceRepository`, `authPrincipal` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT` |
| **Packages** | lowercase, domain-based | `com.openframe.api.service` |

#### Method Organization

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceService {
    
    // Dependencies first
    private final DeviceRepository deviceRepository;
    private final OrganizationService organizationService;
    
    // Public methods
    public Device createDevice(CreateDeviceRequest request, AuthPrincipal principal) {
        // Implementation
    }
    
    public Device updateDevice(String deviceId, UpdateDeviceRequest request, 
                              AuthPrincipal principal) {
        // Implementation
    }
    
    // Private helper methods
    private void validateDeviceCreation(CreateDeviceRequest request, AuthPrincipal principal) {
        // Validation logic
    }
    
    private Device buildDevice(CreateDeviceRequest request, AuthPrincipal principal) {
        // Construction logic
    }
    
    private void publishDeviceCreatedEvent(Device device) {
        // Event publishing
    }
}
```

#### Error Handling

```java
// ✅ GOOD: Specific exceptions with context
@Service
public class DeviceService {
    
    public Device findById(String deviceId, AuthPrincipal principal) {
        Device device = deviceRepository.findById(deviceId)
            .orElseThrow(() -> new DeviceNotFoundException(
                "Device not found: " + deviceId));
        
        if (!device.getTenantId().equals(principal.getTenantId())) {
            throw new TenantAccessViolationException(
                "Device " + deviceId + " not accessible to tenant " + 
                principal.getTenantId());
        }
        
        return device;
    }
}

// ❌ BAD: Generic exceptions, poor error messages
public Device findById(String deviceId, AuthPrincipal principal) {
    Device device = deviceRepository.findById(deviceId)
        .orElseThrow(() -> new RuntimeException("Not found"));
    
    if (!device.getTenantId().equals(principal.getTenantId())) {
        throw new Exception("Access denied");
    }
    
    return device;
}
```

### Documentation Standards

#### JavaDoc Requirements

All public APIs must have comprehensive JavaDoc:

```java
/**
 * Creates a new device within the specified organization.
 * 
 * <p>This method performs tenant validation to ensure the requesting user
 * has access to the target organization. The created device will inherit
 * the tenant context from the authenticated principal.
 * 
 * @param request the device creation request containing device details
 * @param principal the authenticated user making the request
 * @return the newly created device with generated ID and timestamps
 * @throws OrganizationNotFoundException if the specified organization doesn't exist
 * @throws TenantAccessViolationException if the user cannot access the organization
 * @throws DeviceValidationException if the device data fails validation
 * @since 5.30.0
 */
public Device createDevice(CreateDeviceRequest request, AuthPrincipal principal) {
    // Implementation
}
```

#### Code Comments

```java
// ✅ GOOD: Explain WHY, not WHAT
public void rotateEncryptionKeys() {
    // Rotate keys every 90 days to maintain security compliance
    // and limit exposure window in case of key compromise
    if (isKeyRotationDue()) {
        generateNewEncryptionKey();
    }
}

// ❌ BAD: Comments that state the obvious
public void rotateEncryptionKeys() {
    // Check if key rotation is due
    if (isKeyRotationDue()) {
        // Generate new encryption key
        generateNewEncryptionKey();
    }
}
```

## Testing Requirements

### Mandatory Testing Standards

Every contribution must include appropriate tests:

#### Unit Tests (Required)

```java
// ✅ Required for all service methods
@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {
    
    @Test
    @DisplayName("Should create device with valid organization access")
    void shouldCreateDeviceWithValidOrganizationAccess() {
        // Given
        String tenantId = "tenant-123";
        CreateDeviceRequest request = CreateDeviceRequest.builder()
            .name("Test Device")
            .organizationId("org-456")
            .type(DeviceType.LAPTOP)
            .build();
            
        Organization org = Organization.builder()
            .id("org-456")
            .tenantId(tenantId)
            .build();
            
        AuthPrincipal principal = createTestPrincipal(tenantId);
        
        when(organizationService.findById("org-456")).thenReturn(org);
        when(deviceRepository.save(any(Device.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        
        // When
        Device result = deviceService.createDevice(request, principal);
        
        // Then
        assertThat(result)
            .satisfies(device -> {
                assertThat(device.getName()).isEqualTo("Test Device");
                assertThat(device.getTenantId()).isEqualTo(tenantId);
                assertThat(device.getOrganizationId()).isEqualTo("org-456");
            });
            
        verify(eventPublisher).publishEvent(any(DeviceCreatedEvent.class));
    }
    
    @Test
    @DisplayName("Should reject device creation for inaccessible organization")
    void shouldRejectDeviceCreationForInaccessibleOrganization() {
        // Given
        String userTenantId = "tenant-123";
        String orgTenantId = "tenant-456"; // Different tenant
        
        CreateDeviceRequest request = CreateDeviceRequest.builder()
            .organizationId("org-789")
            .build();
            
        Organization org = Organization.builder()
            .id("org-789")
            .tenantId(orgTenantId) // Different tenant
            .build();
            
        AuthPrincipal principal = createTestPrincipal(userTenantId);
        
        when(organizationService.findById("org-789")).thenReturn(org);
        
        // When/Then
        assertThatThrownBy(() -> deviceService.createDevice(request, principal))
            .isInstanceOf(TenantAccessViolationException.class)
            .hasMessageContaining("org-789")
            .hasMessageContaining(userTenantId);
            
        verifyNoInteractions(deviceRepository, eventPublisher);
    }
}
```

#### Integration Tests (For Complex Features)

```java
// Required for new API endpoints, data layer changes
@SpringBootTest
@Tag("integration")
@Testcontainers
class DeviceServiceIntegrationTest {
    
    @Container
    static MongoDBContainer mongodb = new MongoDBContainer("mongo:7");
    
    @Test
    @DisplayName("Should enforce tenant isolation in database queries")
    void shouldEnforceTenantIsolationInDatabaseQueries() {
        // Implementation with real database
    }
}
```

### Test Coverage Requirements

- **Minimum coverage**: 80% for new code
- **Critical paths**: 100% coverage for security-related code
- **Edge cases**: Must include negative test cases
- **Performance**: Load tests for performance-critical features

## Commit Message Standards

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(api): add device filtering by organization` |
| `fix` | Bug fix | `fix(security): prevent tenant data leakage in device queries` |
| `docs` | Documentation | `docs(api): add device management tutorial` |
| `style` | Code style changes | `style(core): apply consistent formatting to util classes` |
| `refactor` | Code refactoring | `refactor(service): extract device validation logic` |
| `test` | Test additions/updates | `test(device): add integration tests for device service` |
| `chore` | Maintenance tasks | `chore(deps): update Spring Boot to 3.3.1` |
| `security` | Security improvements | `security(auth): implement rate limiting for login attempts` |

### Good Commit Examples

```bash
# ✅ GOOD: Clear, specific, explains impact
feat(api): implement device status filtering with tenant isolation

Add new endpoint parameter 'status' to device search API. Includes
tenant-aware filtering to prevent cross-tenant data access.

- Add DeviceStatus enum to filter criteria
- Update repository with tenant-scoped queries  
- Include integration tests for tenant isolation
- Update API documentation

Closes #123

# ✅ GOOD: Bug fix with context
fix(security): prevent JWT token leakage in error responses

Remove JWT tokens from exception messages and error responses
to prevent accidental token exposure in logs or client responses.

- Sanitize AuthenticationException messages
- Update error response DTOs
- Add security integration test

Fixes #456

# ✅ GOOD: Documentation improvement  
docs(development): add security testing guidelines

Expand testing documentation with security-focused test patterns,
including examples for authentication, authorization, and input validation.
```

### Bad Commit Examples

```bash
# ❌ BAD: Vague, no context
fix: stuff

# ❌ BAD: No description of what changed
feat: new feature

# ❌ BAD: Too generic
update: changes

# ❌ BAD: Multiple unrelated changes
feat: add device API and fix user bug and update docs
```

## Pull Request Process

### Before Creating a Pull Request

1. **Sync with main branch**:
   ```bash
   git checkout main
   git pull origin main
   git checkout your-feature-branch
   git rebase main
   ```

2. **Run all tests**:
   ```bash
   mvn clean test
   ```

3. **Check code style**:
   ```bash
   mvn checkstyle:check
   ```

4. **Update documentation** if needed

### Pull Request Template

```markdown
## Description

Brief description of changes and their purpose.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Security improvement

## Testing

- [ ] Unit tests added/updated and passing
- [ ] Integration tests added/updated and passing
- [ ] Security tests added if applicable
- [ ] Manual testing completed

## Security Checklist

- [ ] No sensitive data exposed in logs or responses
- [ ] Input validation implemented where applicable
- [ ] Authentication/authorization properly implemented
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified

## Documentation

- [ ] Code is self-documenting with clear naming
- [ ] JavaDoc added for public APIs
- [ ] README updated if needed
- [ ] API documentation updated if needed

## Breaking Changes

List any breaking changes and migration steps required.

## Related Issues

Closes #issue_number
```

### Pull Request Requirements

#### Code Review Checklist

**Functionality**
- [ ] Code solves the intended problem
- [ ] Edge cases are handled appropriately
- [ ] Error handling is comprehensive
- [ ] Performance impact is acceptable

**Code Quality**
- [ ] Code follows project conventions
- [ ] Methods are focused and single-purpose
- [ ] Code is readable and well-organized
- [ ] No code duplication without justification

**Security**
- [ ] Input validation is present
- [ ] Authentication/authorization is correct
- [ ] No sensitive data is exposed
- [ ] Tenant isolation is maintained

**Testing**
- [ ] Adequate test coverage (minimum 80%)
- [ ] Tests are meaningful and not just for coverage
- [ ] Integration tests for complex features
- [ ] Security tests for security-sensitive changes

**Documentation**
- [ ] Public APIs have JavaDoc
- [ ] Complex logic is documented
- [ ] README/guides updated if needed

## Branch Strategy

### Branch Naming Convention

```text
<type>/<short-description>

Examples:
feat/device-status-filtering
fix/jwt-token-leakage
docs/api-authentication-guide
security/input-validation-enhancement
```

### Workflow

1. **Create feature branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature-name
   ```

2. **Make commits** following commit message standards

3. **Keep branch updated**:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

4. **Create Pull Request** when ready

5. **Address review feedback**

6. **Merge after approval** (squash merge preferred)

## Code Review Process

### Review Guidelines

#### For Reviewers

**Focus Areas:**
1. **Correctness**: Does the code work as intended?
2. **Security**: Are there any security implications?
3. **Performance**: Will this impact system performance?
4. **Maintainability**: Is the code easy to understand and modify?
5. **Testing**: Is the code adequately tested?

**Review Etiquette:**
- Be constructive and specific in feedback
- Ask questions to understand the approach
- Suggest alternatives when appropriate
- Approve when code meets standards

**Example Review Comments:**
```text
✅ GOOD:
"Consider extracting this validation logic into a separate method 
for better readability and testability. Something like 
`validateDeviceAccess(device, principal)` would make the intent clearer."

❌ BAD:
"This is wrong."
```

#### For Contributors

**Responding to Reviews:**
- Address all feedback promptly
- Ask for clarification if feedback is unclear
- Explain your approach when necessary
- Push updates to the same branch

**Making Changes:**
```bash
# Make requested changes
git add .
git commit -m "address review feedback: extract validation logic"
git push origin feat/your-feature-name
```

### Review Approval

**Required Approvals:**
- **1 approval** for documentation and minor fixes
- **2 approvals** for new features and significant changes
- **Security team review** for security-related changes

## Release Process

### Versioning Strategy

OpenFrame follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (5.x.0): Breaking changes
- **MINOR** (5.30.0): New features, backwards compatible
- **PATCH** (5.30.1): Bug fixes, backwards compatible

### Release Checklist

1. **Update version** in parent POM
2. **Update CHANGELOG.md** with release notes
3. **Run full test suite**
4. **Create release tag**
5. **Build and publish artifacts**
6. **Update documentation**
7. **Announce release**

## Getting Help

### Where to Ask Questions

1. **Technical Questions**: [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
2. **Bug Reports**: GitHub Issues (when available)
3. **Feature Requests**: Community discussion in Slack
4. **Security Issues**: Private communication through Slack

### Resources

- **Architecture Guide**: [Architecture Overview](../architecture/README.md)
- **Development Setup**: [Local Development](../setup/local-development.md)
- **Security Guidelines**: [Security Best Practices](../security/README.md)
- **Testing Guide**: [Testing Overview](../testing/README.md)

## Community Standards

### Code of Conduct

We are committed to providing a welcoming and inclusive environment:

- **Be respectful** in all interactions
- **Be collaborative** and help others learn
- **Be constructive** in feedback and discussions
- **Be patient** with newcomers and questions
- **Report inappropriate behavior** to community moderators

### Recognition

We appreciate all contributions and recognize contributors through:
- Contributor credits in release notes
- Community highlights in Slack
- Collaboration opportunities on advanced features

## Troubleshooting Common Issues

### Build Issues

```bash
# Clear Maven cache
rm -rf ~/.m2/repository/com/openframe
mvn clean install

# Skip tests if needed for dependency issues
mvn clean install -DskipTests

# Update IDE project
# IntelliJ: File → Reload Maven Project
# Eclipse: Right-click project → Maven → Reload Projects
```

### Test Issues

```bash
# Run tests with debug output
mvn test -X

# Run specific test
mvn test -Dtest="DeviceServiceTest#shouldCreateDevice"

# Skip integration tests
mvn test -Dgroups="!integration"
```

### Git Issues

```bash
# Sync with main branch
git fetch origin
git rebase origin/main

# Fix merge conflicts
git add resolved-files
git rebase --continue

# Reset branch to match main
git reset --hard origin/main
```

---

Thank you for contributing to OpenFrame OSS Lib! Your contributions help build better MSP tools for the entire community. 

Questions? Join us in the [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) – we're here to help! 🚀