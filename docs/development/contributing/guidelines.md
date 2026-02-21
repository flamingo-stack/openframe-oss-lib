# Contributing Guidelines

Welcome to the OpenFrame OSS Lib contributor community! This guide provides comprehensive information about contributing to the project, from code standards to submission processes.

## Getting Started

### Prerequisites for Contributors

Before contributing, ensure you have:

- ✅ **Development environment** set up ([Environment Setup](../setup/environment.md))
- ✅ **Local development stack** running ([Local Development](../setup/local-development.md))
- ✅ **Architecture understanding** ([Architecture Overview](../architecture/README.md))
- ✅ **Testing knowledge** ([Testing Guide](../testing/README.md))
- ✅ **Security awareness** ([Security Best Practices](../security/README.md))

### Community Guidelines

OpenFrame OSS Lib follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). By participating, you agree to uphold this code.

**Key Principles:**
- 🤝 **Be respectful** and inclusive in all interactions
- 🔍 **Be thorough** in code reviews and testing
- 📚 **Document your changes** clearly and comprehensively
- 🛡️ **Prioritize security** in all contributions
- 🧪 **Test everything** - no untested code gets merged

## Development Workflow

### 1. Setting Up Your Contribution

```bash
# Fork the repository on GitHub
# Clone your fork locally
git clone https://github.com/YOUR_USERNAME/openframe-oss-lib.git
cd openframe-oss-lib

# Add upstream remote
git remote add upstream https://github.com/flamingo-stack/openframe-oss-lib.git

# Create a feature branch
git checkout -b feature/your-feature-name

# Start development environment
./scripts/start-dev.sh
```

### 2. Making Changes

#### Branch Naming Convention

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

#### Development Process

```bash
# Keep your branch up to date
git fetch upstream
git rebase upstream/main

# Make your changes
# ... develop, test, commit ...

# Run the full test suite
mvn clean test -Dspring.profiles.active=test

# Check code quality
mvn spotbugs:check checkstyle:check

# Build all modules
mvn clean install -DskipTests
```

### 3. Commit Standards

#### Commit Message Format

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

# Bug fix
git commit -m "fix(security): prevent JWT token replay attacks

- Add jti (JWT ID) claim to all tokens
- Implement token blacklist using Redis
- Update validation logic to check blacklist
- Add security tests for token replay scenarios

Security impact: Prevents token reuse after logout
Fixes #456"

# Documentation
git commit -m "docs(contributing): update branch naming conventions

- Add examples for different contribution types
- Clarify security contribution requirements
- Update commit message format guidelines"
```

#### Commit Best Practices

- **Keep commits atomic** - One logical change per commit
- **Write clear commit messages** - Explain what and why, not just what
- **Reference issues** - Use "Closes #123", "Fixes #456", "Refs #789"
- **Sign your commits** - Use `git commit -s` for Developer Certificate of Origin

### 4. Code Quality Standards

#### Java Code Style

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

// ✅ Good: Service layer with proper error handling
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class DeviceService {
    
    private final DeviceRepository deviceRepository;
    private final EventPublisher eventPublisher;
    
    public DeviceResponse create(CreateDeviceRequest request, String tenantId) {
        validateCreateRequest(request, tenantId);
        
        Device device = Device.builder()
            .id(UUID.randomUUID().toString())
            .tenantId(tenantId)
            .name(request.getName())
            .type(request.getType())
            .status(DeviceStatus.ACTIVE)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
            
        Device savedDevice = deviceRepository.save(device);
        
        // Publish domain event
        eventPublisher.publishEvent(
            DeviceCreatedEvent.of(savedDevice, tenantId)
        );
        
        return DeviceMapper.toResponse(savedDevice);
    }
    
    private void validateCreateRequest(CreateDeviceRequest request, String tenantId) {
        if (deviceRepository.existsByNameAndTenantId(request.getName(), tenantId)) {
            throw new DuplicateDeviceNameException(request.getName(), tenantId);
        }
    }
}
```

#### Repository Patterns

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
    
    // ❌ Avoid: Global queries without tenant context
    // Page<Device> findByStatus(DeviceStatus status, Pageable pageable);
}
```

#### Security Implementation

All new endpoints must implement proper security:

```java
// ✅ Good: Comprehensive security implementation
@RestController
@RequestMapping("/api/organizations")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class OrganizationController {
    
    private final OrganizationService organizationService;
    
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
    
    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    @Auditable(action = "CREATE_ORGANIZATION", resourceType = "ORGANIZATION")
    public ResponseEntity<OrganizationResponse> createOrganization(
        @Valid @RequestBody CreateOrganizationRequest request,
        @AuthenticationPrincipal AuthPrincipal principal
    ) {
        OrganizationResponse org = organizationService.create(request, principal.getTenantId());
        
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .header("Location", "/api/organizations/" + org.getId())
            .body(org);
    }
}
```

### 5. Testing Requirements

#### Test Coverage Requirements

All contributions must maintain or improve test coverage:

- **Unit tests**: 85%+ line coverage for new code
- **Integration tests**: Cover all new API endpoints
- **Security tests**: Test all authentication and authorization paths
- **Performance tests**: For performance-critical changes

#### Test Implementation Examples

```java
// Unit test example
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
    
    @Test
    @DisplayName("Should throw exception when device name already exists")
    void shouldThrowExceptionWhenDeviceNameExists() {
        // Given
        String tenantId = "tenant-123";
        CreateDeviceRequest request = CreateDeviceRequest.builder()
            .name("Existing Device")
            .build();
            
        when(deviceRepository.existsByNameAndTenantId("Existing Device", tenantId))
            .thenReturn(true);
        
        // When & Then
        assertThatThrownBy(() -> deviceService.create(request, tenantId))
            .isInstanceOf(DuplicateDeviceNameException.class)
            .hasMessage("Device name 'Existing Device' already exists for tenant: tenant-123");
    }
}
```

#### Integration Test Example

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "spring.profiles.active=test")
class DeviceIntegrationTest extends BaseAuthorizedTest {
    
    @Test
    @DisplayName("Should create and retrieve device via API")
    void shouldCreateAndRetrieveDeviceViaApi() {
        // Given
        CreateDeviceRequest request = CreateDeviceRequest.builder()
            .name("Integration Test Device")
            .type(DeviceType.SERVER)
            .machineId("machine-integration-test")
            .build();
        
        // When - Create device
        ResponseEntity<DeviceResponse> createResponse = restTemplate.exchange(
            "/api/devices",
            HttpMethod.POST,
            new HttpEntity<>(request, createAuthHeaders()),
            DeviceResponse.class
        );
        
        // Then - Verify creation
        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(createResponse.getBody().getName()).isEqualTo("Integration Test Device");
        
        String deviceId = createResponse.getBody().getId();
        
        // When - Retrieve device
        ResponseEntity<DeviceResponse> getResponse = restTemplate.exchange(
            "/api/devices/" + deviceId,
            HttpMethod.GET,
            new HttpEntity<>(createAuthHeaders()),
            DeviceResponse.class
        );
        
        // Then - Verify retrieval
        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(getResponse.getBody().getId()).isEqualTo(deviceId);
        assertThat(getResponse.getBody().getName()).isEqualTo("Integration Test Device");
    }
}
```

### 6. Documentation Requirements

#### Code Documentation

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

#### API Documentation

Update OpenAPI specifications for new endpoints:

```java
@RestController
@RequestMapping("/api/devices")
@Tag(name = "Devices", description = "Device management operations")
public class DeviceController {
    
    @PostMapping
    @Operation(
        summary = "Create a new device",
        description = "Creates a new device for the authenticated user's tenant",
        responses = {
            @ApiResponse(
                responseCode = "201",
                description = "Device created successfully",
                content = @Content(schema = @Schema(implementation = DeviceResponse.class))
            ),
            @ApiResponse(
                responseCode = "400",
                description = "Invalid request data",
                content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                responseCode = "409",
                description = "Device name already exists",
                content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
        }
    )
    public ResponseEntity<DeviceResponse> createDevice(
        @Parameter(description = "Device creation request", required = true)
        @Valid @RequestBody CreateDeviceRequest request,
        @AuthenticationPrincipal AuthPrincipal principal
    ) {
        // Implementation...
    }
}
```

## Pull Request Process

### 1. Pre-Submission Checklist

Before submitting a pull request, ensure:

- [ ] **All tests pass** locally and in CI
- [ ] **Code coverage** meets minimum requirements (85% for new code)
- [ ] **Security tests** are included for security-related changes
- [ ] **Documentation** is updated for API changes
- [ ] **Commit messages** follow conventional format
- [ ] **Branch** is up-to-date with main/develop
- [ ] **No merge conflicts** exist

### 2. Pull Request Template

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

## Changes Made

- [ ] Added/Modified API endpoints
- [ ] Updated database schemas
- [ ] Changed security configurations  
- [ ] Modified build or deployment scripts
- [ ] Updated documentation

### API Changes (if applicable)

- **New endpoints**: List any new API endpoints
- **Modified endpoints**: List any changes to existing endpoints
- **Breaking changes**: Describe any breaking changes

### Security Impact (if applicable)

- **Authentication changes**: Describe authentication modifications
- **Authorization changes**: Describe permission modifications
- **Data access changes**: Describe data isolation modifications
- **Security vulnerability fixes**: Reference CVE or security issue

## Testing

### Test Coverage

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Security tests added/updated
- [ ] Performance tests added/updated (if applicable)

### Test Results

```bash
# Include test execution results
mvn test -Dtest=*Test
mvn test -Dtest=*IntegrationTest
```

## Deployment Notes

- [ ] Database migrations required
- [ ] Configuration changes required
- [ ] Environment variable updates required
- [ ] Special deployment considerations

## Reviewer Notes

Additional context for reviewers, including:
- Areas that need special attention
- Potential concerns or trade-offs
- Design decisions and their rationale

## Screenshots (if applicable)

For UI changes, include before and after screenshots.
```

### 3. Review Process

#### Automated Checks

All PRs undergo automated validation:

```yaml
# GitHub Actions will check:
- ✅ Build success (mvn clean install)
- ✅ Test success (unit + integration tests)
- ✅ Code quality (Checkstyle, SpotBugs)
- ✅ Security scan (dependency vulnerabilities)
- ✅ Documentation build (if docs changed)
```

#### Manual Review Criteria

Reviewers will evaluate:

1. **Code Quality**
   - Follows established patterns and conventions
   - Proper error handling and validation
   - Clean, readable, and maintainable code

2. **Security**
   - Proper authentication and authorization
   - Tenant isolation maintained
   - No security vulnerabilities introduced

3. **Testing**
   - Adequate test coverage
   - Tests are meaningful and well-written
   - All edge cases covered

4. **Documentation**
   - Code is properly documented
   - API changes have updated specifications
   - README or guides updated if needed

5. **Performance**
   - No performance regressions
   - Efficient database queries
   - Proper caching where applicable

#### Review Response

When addressing review feedback:

```bash
# Make requested changes
git add .
git commit -m "fix: address review feedback

- Update validation logic per reviewer comments
- Add missing test cases for edge conditions
- Improve error message clarity"

# Push changes
git push origin feature/your-feature-name
```

## Special Contribution Types

### Security Contributions

Security-related contributions require additional scrutiny:

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

## Community Interaction

### Getting Help

- **Documentation**: Start with project documentation
- **Community Slack**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **GitHub Discussions**: For design discussions and questions
- **Issues**: For bug reports and feature requests

### Reporting Issues

When reporting bugs or requesting features:

1. **Search existing issues** first
2. **Use issue templates** provided
3. **Provide detailed information** including:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Log output (sanitized)

### Code Review Etiquette

As a reviewer:
- ✅ Be constructive and respectful
- ✅ Explain the "why" behind your suggestions
- ✅ Recognize good work and improvements
- ✅ Focus on code, not the person

As a contributor:
- ✅ Be open to feedback
- ✅ Ask for clarification when needed
- ✅ Respond promptly to review comments
- ✅ Thank reviewers for their time

## Recognition

Contributors are recognized through:

- **Contributor list** in project README
- **Release notes** mentioning significant contributions
- **Community highlights** in project communications
- **Maintainer opportunities** for consistent contributors

---

## Resources

### Essential Reading
- **[Architecture Overview](../architecture/README.md)** - System design and patterns
- **[Security Best Practices](../security/README.md)** - Security implementation
- **[Testing Guide](../testing/README.md)** - Testing strategies and tools

### Development Tools
- **IntelliJ IDEA** with Spring Boot and Lombok plugins
- **Docker** for development environment
- **MongoDB Compass** for database management
- **Redis CLI** for cache inspection

### Community
- **Slack**: [OpenMSP Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- **GitHub**: [OpenFrame OSS Lib Repository](https://github.com/flamingo-stack/openframe-oss-lib)
- **Website**: [flamingo.run](https://flamingo.run) | [openframe.ai](https://openframe.ai)

Thank you for contributing to OpenFrame OSS Lib! Your contributions help build the future of open-source MSP platforms.