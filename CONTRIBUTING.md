# Contributing to OpenFrame OSS Lib

Welcome to the OpenFrame OSS Lib community! 🎉 We're excited you want to contribute to building better MSP tools for everyone. This guide outlines everything you need to know to contribute effectively.

## 🚀 Quick Start for Contributors

### 1. Join the Community

**All discussions happen on Slack** - we don't use GitHub Issues or Discussions:

- **Join**: [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **Get Support**: Ask questions in relevant channels
- **Discuss Features**: Propose ideas and get feedback
- **Report Issues**: Share bugs and problems

### 2. Set Up Your Development Environment

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Build all modules
mvn clean install

# Verify everything works
mvn test
```

**Prerequisites:**
- Java 21 or higher
- Maven 3.8+
- Docker (for integration testing)
- IDE of choice (IntelliJ IDEA recommended)

### 3. Understand the Architecture

Before making changes, familiarize yourself with:
- [Architecture Overview](docs/development/architecture/README.md) - System design and patterns
- [Local Development Guide](docs/development/setup/local-development.md) - Development workflow
- [Security Guidelines](docs/development/security/README.md) - Security best practices

## 📋 Types of Contributions

We welcome all types of contributions:

| Type | Description | Examples |
|------|-------------|----------|
| 🐛 **Bug Fixes** | Fix issues and improve stability | Resolve NPEs, fix memory leaks |
| ✨ **Features** | Add new functionality | New API endpoints, integrations |
| 📚 **Documentation** | Improve guides and examples | API docs, tutorials, README |
| 🧪 **Testing** | Add test coverage | Unit tests, integration tests |
| 🔧 **Refactoring** | Improve code quality | Extract methods, improve naming |
| 🔐 **Security** | Security improvements | Fix vulnerabilities, add validation |
| 🎨 **Performance** | Optimize performance | Reduce memory usage, speed up queries |

## 🏗️ Development Standards

### Code Quality Standards

#### Java Conventions

Follow these patterns for consistent, maintainable code:

```java
// ✅ GOOD: Clean, well-structured service
@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceManagementService {
    
    private final DeviceRepository deviceRepository;
    private final OrganizationService organizationService;
    private final ApplicationEventPublisher eventPublisher;
    
    /**
     * Creates a new device with tenant validation.
     * 
     * @param request device creation details
     * @param principal authenticated user context
     * @return created device with generated metadata
     */
    public Device createDevice(CreateDeviceRequest request, AuthPrincipal principal) {
        log.debug("Creating device '{}' for tenant '{}'", 
                 request.getName(), principal.getTenantId());
        
        validateDeviceCreation(request, principal);
        
        Device device = buildDeviceFromRequest(request, principal);
        Device savedDevice = deviceRepository.save(device);
        
        eventPublisher.publishEvent(new DeviceCreatedEvent(savedDevice));
        
        return savedDevice;
    }
    
    private void validateDeviceCreation(CreateDeviceRequest request, AuthPrincipal principal) {
        // Validation logic with specific exception messages
        if (!organizationService.hasAccess(request.getOrganizationId(), principal)) {
            throw new TenantAccessViolationException(
                "Organization " + request.getOrganizationId() + 
                " not accessible to tenant " + principal.getTenantId());
        }
    }
}

// ❌ BAD: Poor structure and naming
@Service
public class DeviceService {
    @Autowired DeviceRepository repo;
    @Autowired OrganizationService orgService;
    
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
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT_MS` |
| **Packages** | lowercase, domain-based | `com.openframe.api.service` |

#### Error Handling

Provide specific, actionable error messages:

```java
// ✅ GOOD: Specific exceptions with context
public Device findDeviceById(String deviceId, AuthPrincipal principal) {
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

// ❌ BAD: Generic exceptions, poor messages
public Device findDeviceById(String deviceId, AuthPrincipal principal) {
    Device device = deviceRepository.findById(deviceId)
        .orElseThrow(() -> new RuntimeException("Not found"));
    // No tenant validation!
    return device;
}
```

### Testing Requirements

**All contributions must include appropriate tests:**

#### Unit Tests (Required)

```java
@ExtendWith(MockitoExtension.class)
@DisplayName("DeviceService")
class DeviceServiceTest {
    
    @Test
    @DisplayName("Should create device with valid tenant access")
    void shouldCreateDeviceWithValidTenantAccess() {
        // Given
        String tenantId = "tenant-123";
        CreateDeviceRequest request = CreateDeviceRequest.builder()
            .name("Test Device")
            .organizationId("org-456")
            .build();
            
        AuthPrincipal principal = createTestPrincipal(tenantId);
        
        when(organizationService.hasAccess("org-456", principal))
            .thenReturn(true);
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
    @DisplayName("Should reject device creation for unauthorized tenant")
    void shouldRejectDeviceCreationForUnauthorizedTenant() {
        // Given
        CreateDeviceRequest request = CreateDeviceRequest.builder()
            .organizationId("org-789")
            .build();
            
        AuthPrincipal principal = createTestPrincipal("tenant-123");
        
        when(organizationService.hasAccess("org-789", principal))
            .thenReturn(false);
        
        // When/Then
        assertThatThrownBy(() -> deviceService.createDevice(request, principal))
            .isInstanceOf(TenantAccessViolationException.class)
            .hasMessageContaining("org-789")
            .hasMessageContaining("tenant-123");
            
        verifyNoInteractions(deviceRepository, eventPublisher);
    }
}
```

#### Integration Tests (For Complex Features)

```java
@SpringBootTest
@Tag("integration")
@Testcontainers
class DeviceServiceIntegrationTest {
    
    @Container
    static MongoDBContainer mongodb = new MongoDBContainer("mongo:7");
    
    @Test
    @DisplayName("Should enforce tenant isolation in real database")
    void shouldEnforceTenantIsolationInDatabase() {
        // Test with real database to verify tenant queries work correctly
    }
}
```

### Coverage Requirements

- **Minimum**: 80% line coverage for new code
- **Security code**: 100% coverage for authentication/authorization
- **Critical paths**: 95% coverage for data persistence
- **Edge cases**: Include negative test scenarios

## 🔄 Development Workflow

### Branch Strategy

```bash
# 1. Create feature branch from main
git checkout main
git pull origin main
git checkout -b feat/device-status-filtering

# 2. Make changes and commit with good messages
git add .
git commit -m "feat(api): add device status filtering with tenant isolation

Add new endpoint parameter 'status' to device search API. Includes
tenant-aware filtering to prevent cross-tenant data access.

- Add DeviceStatus enum to filter criteria
- Update repository with tenant-scoped queries  
- Include integration tests for tenant isolation

Closes #123"

# 3. Keep branch updated
git fetch origin
git rebase origin/main

# 4. Push and create PR
git push origin feat/device-status-filtering
```

### Commit Message Standards

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

#### Commit Types

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(api): add device organization filtering` |
| `fix` | Bug fix | `fix(security): prevent tenant data leakage` |
| `docs` | Documentation | `docs(api): add authentication examples` |
| `style` | Code formatting | `style(service): apply consistent formatting` |
| `refactor` | Code refactoring | `refactor(service): extract validation logic` |
| `test` | Test changes | `test(device): add tenant isolation tests` |
| `chore` | Maintenance | `chore(deps): update Spring Boot to 3.3.1` |
| `security` | Security fix | `security(auth): implement rate limiting` |

#### Good Commit Examples

```bash
# ✅ Feature with context
feat(stream): implement real-time device event processing

Add Kafka consumer for device lifecycle events with tenant-aware
message routing. Includes dead letter queue for failed processing.

- Add DeviceEventConsumer with error handling
- Implement tenant context propagation  
- Add monitoring metrics for event processing
- Update documentation with event flow diagrams

# ✅ Bug fix with specifics
fix(auth): prevent JWT token leakage in error responses

Remove JWT tokens from exception messages to prevent accidental
exposure in logs and client error responses.

- Sanitize AuthenticationException messages
- Update ErrorResponse DTO to exclude sensitive data
- Add security integration test for token sanitization

Fixes #456

# ✅ Documentation improvement
docs(development): add tenant isolation testing patterns

Add comprehensive examples for testing multi-tenant features,
including database isolation, cache key prefixing, and event routing.
```

## 🔍 Pull Request Process

### Before Creating a PR

1. **Discuss in Slack** - Get feedback on your approach
2. **Run full test suite** - `mvn clean test`
3. **Update documentation** - Add/update relevant docs
4. **Self-review** - Check your changes thoroughly

### PR Requirements

Your pull request must include:

#### Code Quality Checklist
- [ ] Code follows project conventions
- [ ] Methods are focused and single-purpose  
- [ ] Error handling is comprehensive
- [ ] No code duplication without justification

#### Security Checklist
- [ ] Input validation implemented
- [ ] Authentication/authorization enforced  
- [ ] No sensitive data in logs/responses
- [ ] Tenant isolation maintained

#### Testing Checklist
- [ ] Unit tests with 80%+ coverage
- [ ] Integration tests for complex features
- [ ] Security tests for auth changes
- [ ] Performance tests for data operations

#### Documentation Checklist
- [ ] JavaDoc for public APIs
- [ ] Complex logic documented
- [ ] README/guides updated if needed
- [ ] API documentation updated

### PR Template

```markdown
## Description

Brief description of changes and motivation.

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)  
- [ ] Breaking change (fix/feature causing existing functionality changes)
- [ ] Documentation update
- [ ] Security improvement

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated  
- [ ] Manual testing completed
- [ ] Performance impact assessed

## Security Impact

- [ ] No new security risks introduced
- [ ] Authentication/authorization properly implemented
- [ ] Input validation added where needed
- [ ] Tenant isolation maintained

## Breaking Changes

List any breaking changes and required migration steps.

## Slack Discussion

Link to relevant Slack thread where this was discussed.
```

### Review Process

**Approval Requirements:**
- 1 approval for docs/minor fixes
- 2 approvals for features/significant changes
- Security team review for auth/security changes

**Review Focus:**
- Correctness and functionality
- Security implications
- Performance impact
- Code maintainability
- Test coverage adequacy

## 🛡️ Security Guidelines

### Tenant Isolation Requirements

**Critical**: Every feature must enforce tenant isolation:

```java
// ✅ GOOD: Tenant-aware query
@Repository
public class DeviceRepository {
    
    public List<Device> findByTenantId(String tenantId, Pageable pageable) {
        Query query = Query.query(
            Criteria.where("tenantId").is(tenantId)
        );
        return mongoTemplate.find(query, Device.class);
    }
}

// ❌ BAD: Missing tenant filtering - SECURITY VIOLATION
public List<Device> findAll(Pageable pageable) {
    return mongoTemplate.find(new Query(), Device.class);
}
```

### Authentication Requirements

```java
// ✅ GOOD: Proper authentication check
@RestController
public class DeviceController {
    
    @GetMapping("/devices/{deviceId}")
    public Device getDevice(@PathVariable String deviceId, 
                           @AuthenticationPrincipal AuthPrincipal principal) {
        
        Device device = deviceService.findById(deviceId);
        
        // Verify tenant access
        if (!device.getTenantId().equals(principal.getTenantId())) {
            throw new TenantAccessViolationException(
                "Device access denied for tenant " + principal.getTenantId());
        }
        
        return device;
    }
}
```

### Input Validation

```java
// ✅ GOOD: Comprehensive validation
@Valid
public class CreateDeviceRequest {
    
    @NotBlank(message = "Device name is required")
    @Size(max = 100, message = "Device name cannot exceed 100 characters")
    @Pattern(regexp = "^[a-zA-Z0-9\\s\\-_]+$", 
             message = "Device name contains invalid characters")
    private String name;
    
    @NotBlank(message = "Organization ID is required")
    @Pattern(regexp = "^[a-zA-Z0-9\\-]+$", 
             message = "Invalid organization ID format")
    private String organizationId;
}
```

## 📖 Documentation Standards

### JavaDoc Requirements

All public APIs need comprehensive JavaDoc:

```java
/**
 * Creates a new device within the specified organization.
 * 
 * <p>This method validates tenant access to the organization before
 * creating the device. The created device inherits the tenant context
 * from the authenticated principal.
 * 
 * @param request the device creation request containing device details
 * @param principal the authenticated user making the request  
 * @return the newly created device with generated ID and timestamps
 * @throws OrganizationNotFoundException if organization doesn't exist
 * @throws TenantAccessViolationException if user lacks organization access
 * @throws DeviceValidationException if device data fails validation
 * @since 5.30.0
 */
public Device createDevice(CreateDeviceRequest request, AuthPrincipal principal) {
    // Implementation
}
```

### Code Comments

Focus on **why**, not **what**:

```java
// ✅ GOOD: Explains the reasoning
public void rotateEncryptionKeys() {
    // Rotate keys every 90 days to maintain compliance with security policy
    // and limit exposure window in case of key compromise
    if (isKeyRotationDue()) {
        generateNewEncryptionKey();
    }
}

// ❌ BAD: States the obvious  
public void rotateEncryptionKeys() {
    // Check if rotation is due
    if (isKeyRotationDue()) {
        // Generate new key
        generateNewEncryptionKey();
    }
}
```

## 🏷️ Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (6.0.0): Breaking changes
- **MINOR** (5.31.0): New features, backwards compatible  
- **PATCH** (5.30.1): Bug fixes, backwards compatible

### Contributing to Releases

1. **Feature freeze** announcement in Slack
2. **Testing period** with release candidates
3. **Documentation updates** for new features
4. **Community feedback** integration
5. **Final release** with changelog

## 🤝 Community Guidelines

### Code of Conduct

We maintain a welcoming, inclusive environment:

- **Be respectful** in all interactions
- **Be collaborative** and help others learn
- **Be constructive** in feedback and discussions  
- **Be patient** with newcomers and questions
- **Report issues** to community moderators

### Getting Help

**Primary Channel**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)

- **#general** - General discussion and introductions
- **#development** - Technical development questions  
- **#help** - Support and troubleshooting
- **#feature-requests** - Ideas and feature discussions

### Recognition

We appreciate contributors through:
- Release note credits
- Community highlights in Slack
- Collaboration opportunities on advanced features
- Referral program for OpenFrame platform beta

## 🔧 Troubleshooting

### Common Build Issues

```bash
# Clear Maven cache and rebuild
rm -rf ~/.m2/repository/com/openframe
mvn clean install

# Skip tests for dependency resolution
mvn clean install -DskipTests

# Update IDE project settings
# IntelliJ: File → Reload Maven Project
# Eclipse: Right-click → Maven → Reload Projects
```

### Test Issues

```bash
# Run with detailed output
mvn test -X

# Run specific test class
mvn test -Dtest="DeviceServiceTest"

# Run specific test method
mvn test -Dtest="DeviceServiceTest#shouldCreateDevice"

# Skip integration tests
mvn test -Dgroups="!integration"
```

### Git Workflow Issues

```bash
# Sync with main branch  
git fetch origin
git rebase origin/main

# Resolve merge conflicts
git add resolved-files
git rebase --continue

# Reset branch to match main (if needed)
git reset --hard origin/main
```

## 🎉 Getting Started

Ready to contribute? Here's your path:

1. **Join Slack** - [OpenMSP Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
2. **Introduce yourself** - Tell us about your background and interests
3. **Pick a task** - Look for "good first issue" discussions in Slack
4. **Set up locally** - Follow the development setup guides
5. **Make your first PR** - Start with documentation or small fixes
6. **Join the conversation** - Participate in architecture discussions

---

Thank you for contributing to OpenFrame OSS Lib! Together we're building the future of MSP platforms. 🚀

Questions? We're here to help in [Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)!