# Contributing Guidelines

Welcome to OpenFrame OSS Libraries! We're excited to have you contribute to the future of open-source MSP tooling. This guide covers everything you need to know to make meaningful contributions to the project.

## Quick Start for Contributors

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/openframe-oss-lib.git
cd openframe-oss-lib

# Add upstream remote
git remote add upstream https://github.com/flamingo-stack/openframe-oss-lib.git
```

### 2. Set Up Development Environment

```bash
# Install dependencies and build
mvn clean install

# Start development services
docker-compose -f docker-compose.dev.yml up -d

# Run the application
cd openframe-api-service-core
mvn spring-boot:run -Dspring-boot.run.profiles=development
```

### 3. Create Feature Branch

```bash
# Always create a new branch for your work
git checkout -b feature/your-feature-name

# Keep your branch up to date
git fetch upstream
git rebase upstream/main
```

## Code Style and Conventions

### Java Code Standards

**Follow Google Java Style Guide with these project-specific adaptations:**

```java
// ✅ GOOD: Proper class structure
@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
@Validated
@Slf4j
public class OrganizationController {
    
    private final OrganizationService organizationService;
    private final OrganizationMapper organizationMapper;
    
    @GetMapping
    public ResponseEntity<Page<OrganizationResponse>> list(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        log.debug("Listing organizations for tenant: {}", principal.getTenantId());
        
        Pageable pageable = PageRequest.of(page, size);
        Page<Organization> organizations = organizationService.findByTenant(
            principal.getTenantId(), 
            pageable
        );
        
        Page<OrganizationResponse> response = organizations.map(organizationMapper::toResponse);
        return ResponseEntity.ok(response);
    }
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Classes** | PascalCase | `OrganizationService`, `UserController` |
| **Methods** | camelCase | `findByTenant()`, `createOrganization()` |
| **Variables** | camelCase | `organizationId`, `tenantContext` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE`, `DEFAULT_TIMEOUT` |
| **Packages** | lowercase | `com.openframe.api.service` |

### Method Naming Patterns

```java
// ✅ Repository methods
public interface OrganizationRepository {
    List<Organization> findByTenantId(String tenantId);
    Optional<Organization> findByTenantIdAndId(String tenantId, String id);
    boolean existsByTenantIdAndName(String tenantId, String name);
    void deleteByTenantIdAndId(String tenantId, String id);
}

// ✅ Service methods
@Service
public class OrganizationService {
    public Organization create(CreateOrganizationRequest request, String tenantId) { }
    public Organization update(String id, UpdateOrganizationRequest request, String tenantId) { }
    public void delete(String id, String tenantId) { }
    public Optional<Organization> findById(String id, String tenantId) { }
    public Page<Organization> findByTenant(String tenantId, Pageable pageable) { }
}

// ✅ Controller methods
@RestController
public class OrganizationController {
    @PostMapping public ResponseEntity<OrganizationResponse> create(...) { }
    @PutMapping("/{id}") public ResponseEntity<OrganizationResponse> update(...) { }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(...) { }
    @GetMapping("/{id}") public ResponseEntity<OrganizationResponse> get(...) { }
    @GetMapping public ResponseEntity<Page<OrganizationResponse>> list(...) { }
}
```

### Code Formatting

**IDE Configuration:**

**IntelliJ IDEA:**
1. **File → Settings → Editor → Code Style → Java**
2. Import scheme: `config/ide/intellij-code-style.xml`
3. Or manually configure:
   - Indentation: 4 spaces
   - Line length: 100 characters
   - Import organization: `java.*`, `javax.*`, then all others

**Eclipse:**
1. **Window → Preferences → Java → Code Style → Formatter**
2. Import profile: `config/ide/eclipse-formatter.xml`

### Documentation Standards

#### JavaDoc Requirements

Document all public APIs:

```java
/**
 * Service for managing organizations within a multi-tenant environment.
 * 
 * <p>This service provides CRUD operations for organizations while ensuring
 * proper tenant isolation and security constraints.
 *
 * @author OpenFrame Team
 * @since 5.32.0
 */
@Service
@RequiredArgsConstructor
public class OrganizationService {
    
    /**
     * Creates a new organization for the specified tenant.
     *
     * @param request the organization creation request containing name and contact info
     * @param tenantId the tenant ID to associate with the organization
     * @return the created organization with generated ID and timestamps
     * @throws OrganizationNameConflictException if an organization with the same name 
     *         already exists for the tenant
     * @throws IllegalArgumentException if request or tenantId is null or invalid
     */
    public Organization create(CreateOrganizationRequest request, String tenantId) {
        // Implementation
    }
}
```

#### Comment Guidelines

```java
// ✅ GOOD: Explain why, not what
@Service
public class UserService {
    
    public User updateUser(String userId, UpdateUserRequest request) {
        // Prevent users from modifying their own admin status to avoid privilege escalation
        if (request.getIsAdmin() != null) {
            throw new SecurityException("Cannot modify admin status");
        }
        
        // Use optimistic locking to prevent concurrent modification issues
        User existingUser = userRepository.findByIdWithLock(userId)
            .orElseThrow(() -> new UserNotFoundException(userId));
            
        return userRepository.save(existingUser);
    }
}

// ❌ BAD: Obvious comments
public User updateUser(String userId, UpdateUserRequest request) {
    // Check if request is not null
    if (request == null) {
        throw new IllegalArgumentException("Request cannot be null");
    }
    
    // Find user by ID
    User user = userRepository.findById(userId);
    
    // Save user
    return userRepository.save(user);
}
```

## Git Workflow and Branch Management

### Branch Naming Convention

```bash
# Feature branches
git checkout -b feature/add-organization-search
git checkout -b feature/implement-sso-google

# Bug fix branches
git checkout -b bugfix/fix-tenant-isolation-issue
git checkout -b bugfix/resolve-jwt-validation-error

# Documentation branches  
git checkout -b docs/update-api-documentation
git checkout -b docs/add-deployment-guide

# Refactoring branches
git checkout -b refactor/extract-security-service
git checkout -b refactor/optimize-database-queries
```

### Commit Message Format

Follow **Conventional Commits** specification:

```bash
# Format: type(scope): description
# 
# type: feat, fix, docs, style, refactor, test, chore
# scope: module or area of change (optional)
# description: imperative, present tense

# Examples:
git commit -m "feat(auth): add support for Google SSO integration"
git commit -m "fix(security): resolve tenant isolation vulnerability in organization API"
git commit -m "docs(api): update GraphQL schema documentation"
git commit -m "refactor(service): extract common pagination logic"
git commit -m "test(integration): add comprehensive organization controller tests"
git commit -m "chore(deps): upgrade Spring Boot to 3.3.1"
```

**Commit Message Guidelines:**

```bash
# ✅ GOOD: Clear, specific, imperative
feat(organizations): add search functionality with filters
fix(auth): prevent JWT token validation bypass 
docs(readme): add development setup instructions
test(service): add unit tests for organization service

# ❌ BAD: Vague, past tense, too generic
Fixed bug
Updated code
Changed some files
WIP
```

### Pull Request Process

#### 1. Before Creating PR

```bash
# Ensure your branch is up to date
git fetch upstream
git rebase upstream/main

# Run all tests
mvn clean verify

# Check code style
mvn checkstyle:check

# Run security analysis
mvn spotbugs:check
```

#### 2. Create Pull Request

**PR Title Format:**
```
feat(auth): implement Google SSO integration
fix(security): resolve tenant data leakage in API endpoints
docs(development): add testing guidelines and best practices
```

**PR Description Template:**
```markdown
## Description
Brief description of what this PR accomplishes.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)  
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All existing tests pass

## Security Considerations
- [ ] Changes reviewed for security implications
- [ ] Tenant isolation maintained
- [ ] Input validation implemented
- [ ] Authentication/authorization properly handled

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated (if needed)
- [ ] No breaking changes without proper migration path
- [ ] Performance impact considered

## Related Issues
Fixes #123
Relates to #456
```

#### 3. PR Review Process

**For Contributors:**
- Address all review comments promptly
- Keep discussions focused and professional
- Update documentation if requested
- Ensure CI passes before requesting re-review

**For Reviewers:**
- Provide constructive feedback
- Focus on code quality, security, and maintainability
- Test the changes locally when needed
- Approve when satisfied with the implementation

### Code Review Guidelines

#### What to Look For

**Security and Safety:**
```java
// ✅ Review: Proper tenant isolation
@GetMapping("/api/organizations/{id}")
public Organization getOrganization(
    @PathVariable String id,
    @AuthenticationPrincipal AuthPrincipal principal
) {
    return organizationService.findById(id, principal.getTenantId());
}

// ❌ Flag: Missing tenant isolation
@GetMapping("/api/organizations/{id}")
public Organization getOrganization(@PathVariable String id) {
    return organizationService.findById(id);  // Could access other tenants!
}
```

**Code Quality:**
```java
// ✅ Review: Clear, maintainable code
public Optional<Organization> findByNameAndTenant(String name, String tenantId) {
    validateInput(name, tenantId);
    return repository.findByTenantIdAndName(tenantId, name);
}

// ❌ Flag: Hard to understand, missing validation
public Optional<Organization> findByNameAndTenant(String name, String tenantId) {
    return repository.findByTenantIdAndName(tenantId != null ? tenantId : "", name == null ? "" : name.trim());
}
```

**Performance:**
```java
// ✅ Review: Efficient database query
public Page<Organization> findByTenantWithDevices(String tenantId, Pageable pageable) {
    return repository.findByTenantIdWithDevices(tenantId, pageable);
}

// ❌ Flag: N+1 query problem
public List<Organization> findByTenantWithDevices(String tenantId) {
    List<Organization> orgs = repository.findByTenantId(tenantId);
    orgs.forEach(org -> org.setDevices(deviceRepository.findByOrganizationId(org.getId())));
    return orgs;
}
```

#### Review Checklist

- [ ] **Security**: Tenant isolation, input validation, proper authentication
- [ ] **Correctness**: Logic is sound, edge cases handled
- [ ] **Performance**: No obvious performance issues, efficient queries
- [ ] **Maintainability**: Code is readable, well-structured, documented
- [ ] **Testing**: Adequate test coverage, tests are meaningful
- [ ] **Breaking Changes**: Proper migration path if breaking existing APIs

## Testing Requirements

### Test Coverage Standards

**Minimum Coverage Requirements:**
- **Unit Tests**: 80% line coverage, 75% branch coverage
- **Integration Tests**: Cover all API endpoints and critical flows
- **Security Tests**: Verify authentication, authorization, and tenant isolation

### Required Tests for New Features

```java
// 1. Unit Tests - Test business logic in isolation
@ExtendWith(MockitoExtension.class)
class OrganizationServiceTest {
    
    @Test
    @DisplayName("Should create organization with valid data")
    void shouldCreateOrganizationWithValidData() {
        // Test implementation
    }
    
    @Test
    @DisplayName("Should throw exception when organization name already exists")
    void shouldThrowExceptionWhenNameExists() {
        // Test implementation  
    }
}

// 2. Integration Tests - Test full request/response cycle
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OrganizationControllerIntegrationTest {
    
    @Test
    @DisplayName("Should create organization via REST API")
    void shouldCreateOrganizationViaRestApi() {
        // Test implementation
    }
}

// 3. Security Tests - Verify security requirements
@SpringBootTest
class OrganizationSecurityTest {
    
    @Test
    @DisplayName("Should enforce tenant isolation")
    void shouldEnforceTenantIsolation() {
        // Test implementation
    }
}
```

### Test Data Management

Use builders for maintainable test data:

```java
public class OrganizationTestDataBuilder {
    private String tenantId = "default-tenant";
    private String name = "Test Organization";
    
    public static OrganizationTestDataBuilder anOrganization() {
        return new OrganizationTestDataBuilder();
    }
    
    public OrganizationTestDataBuilder withTenantId(String tenantId) {
        this.tenantId = tenantId;
        return this;
    }
    
    public Organization build() {
        return Organization.builder()
            .tenantId(tenantId)
            .name(name)
            .build();
    }
}

// Usage in tests
@Test
void testMethod() {
    Organization org = anOrganization()
        .withTenantId("tenant-123")
        .withName("Custom Name")
        .build();
    // Use org in test
}
```

## Documentation Requirements

### Code Documentation

**Required Documentation:**
- All public classes and interfaces
- All public methods with parameters and return values
- Complex business logic and algorithms
- Security-related code
- Configuration and setup instructions

### API Documentation

Update API documentation for:
- New REST endpoints
- New GraphQL queries/mutations
- Changes to existing APIs
- New DTOs or data models

### User Documentation

Update user-facing documentation for:
- New features that affect end users
- Changes to configuration
- New deployment requirements
- Breaking changes and migration guides

## Performance Considerations

### Database Queries

```java
// ✅ GOOD: Efficient pagination with proper indexing
public Page<Organization> findByTenantId(String tenantId, Pageable pageable) {
    return repository.findByTenantId(tenantId, pageable);
}

// ✅ GOOD: Use projection for list views
public List<OrganizationSummary> findSummariesByTenantId(String tenantId) {
    return repository.findSummariesByTenantId(tenantId, OrganizationSummary.class);
}

// ❌ BAD: Loading all data without pagination
public List<Organization> getAllOrganizations(String tenantId) {
    return repository.findByTenantId(tenantId);  // Could be thousands of records
}
```

### Caching Strategy

```java
@Service
public class OrganizationService {
    
    // ✅ GOOD: Cache frequently accessed, rarely changed data
    @Cacheable(value = "organizations", key = "#tenantId + ':' + #id")
    public Optional<Organization> findById(String id, String tenantId) {
        return repository.findByTenantIdAndId(tenantId, id);
    }
    
    // ✅ GOOD: Evict cache on updates
    @CacheEvict(value = "organizations", key = "#tenantId + ':' + #id")
    public Organization update(String id, UpdateOrganizationRequest request, String tenantId) {
        // Update logic
    }
}
```

### Memory Management

```java
// ✅ GOOD: Process large datasets in chunks
public void processAllOrganizations(String tenantId) {
    Pageable pageable = PageRequest.of(0, 100);
    Page<Organization> page;
    
    do {
        page = repository.findByTenantId(tenantId, pageable);
        page.getContent().forEach(this::processOrganization);
        pageable = pageable.next();
    } while (page.hasNext());
}

// ❌ BAD: Loading everything into memory
public void processAllOrganizations(String tenantId) {
    List<Organization> allOrgs = repository.findByTenantId(tenantId);  // OOM risk
    allOrgs.forEach(this::processOrganization);
}
```

## Security Requirements

### Input Validation

```java
// ✅ GOOD: Comprehensive validation
@PostMapping
public ResponseEntity<OrganizationResponse> create(
    @Valid @RequestBody CreateOrganizationRequest request,
    @AuthenticationPrincipal AuthPrincipal principal
) {
    // Additional business rule validation
    if (organizationService.existsByName(request.getName(), principal.getTenantId())) {
        throw new OrganizationNameConflictException(request.getName());
    }
    
    Organization org = organizationService.create(request, principal.getTenantId());
    return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(org));
}
```

### Error Handling

```java
// ✅ GOOD: Don't leak sensitive information
@ExceptionHandler(OrganizationNotFoundException.class)
public ResponseEntity<ErrorResponse> handleOrganizationNotFound(
    OrganizationNotFoundException ex
) {
    // Don't expose whether organization exists in different tenant
    ErrorResponse error = ErrorResponse.builder()
        .code("ORGANIZATION_NOT_FOUND")
        .message("Organization not found")
        .timestamp(Instant.now())
        .build();
    
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
}

// ❌ BAD: Information leakage
@ExceptionHandler(OrganizationNotFoundException.class)
public ResponseEntity<ErrorResponse> handleOrganizationNotFound(
    OrganizationNotFoundException ex
) {
    // This could reveal information about other tenants
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ErrorResponse("Organization " + ex.getId() + " not found"));
}
```

## Common Pitfalls to Avoid

### 1. Tenant Data Leakage

```java
// ❌ WRONG: Can access any tenant's data
@GetMapping("/{id}")
public Organization get(@PathVariable String id) {
    return repository.findById(id).orElseThrow();
}

// ✅ CORRECT: Enforces tenant isolation
@GetMapping("/{id}")
public Organization get(
    @PathVariable String id,
    @AuthenticationPrincipal AuthPrincipal principal
) {
    return repository.findByTenantIdAndId(principal.getTenantId(), id)
        .orElseThrow(() -> new OrganizationNotFoundException(id));
}
```

### 2. N+1 Query Problems

```java
// ❌ WRONG: Causes N+1 queries
public List<OrganizationWithDevices> getOrganizationsWithDevices(String tenantId) {
    List<Organization> orgs = repository.findByTenantId(tenantId);
    return orgs.stream()
        .map(org -> new OrganizationWithDevices(org, deviceRepository.findByOrganizationId(org.getId())))
        .collect(Collectors.toList());
}

// ✅ CORRECT: Single query with join
public List<OrganizationWithDevices> getOrganizationsWithDevices(String tenantId) {
    return repository.findByTenantIdWithDevices(tenantId);
}
```

### 3. Missing Input Validation

```java
// ❌ WRONG: No validation
@PostMapping
public Organization create(@RequestBody CreateOrganizationRequest request) {
    return service.create(request);
}

// ✅ CORRECT: Proper validation
@PostMapping
public ResponseEntity<Organization> create(
    @Valid @RequestBody CreateOrganizationRequest request,
    @AuthenticationPrincipal AuthPrincipal principal
) {
    Organization org = service.create(request, principal.getTenantId());
    return ResponseEntity.status(HttpStatus.CREATED).body(org);
}
```

## Release Process

### Version Management

OpenFrame OSS Libraries uses semantic versioning:

- **Major** (5.x.x): Breaking changes
- **Minor** (x.32.x): New features, backward compatible
- **Patch** (x.x.1): Bug fixes, backward compatible

### Contributing to Releases

1. **Feature Development**: Target next minor version
2. **Bug Fixes**: Can target patch releases
3. **Breaking Changes**: Require major version bump
4. **Documentation**: Can be updated in any release

### Migration Guides

For breaking changes, provide migration documentation:

```markdown
# Migration Guide: v5.x to v6.0

## Breaking Changes

### Authentication API Changes
- `AuthPrincipal.getUser()` → `AuthPrincipal.getUserId()`
- `AuthPrincipal.getTenant()` → `AuthPrincipal.getTenantId()`

**Before:**
```java
String userId = principal.getUser().getId();
```

**After:**
```java
String userId = principal.getUserId();
```

## Deprecation Timeline
- v5.30.0: Methods marked as @Deprecated
- v5.32.0: Deprecation warnings in logs
- v6.0.0: Deprecated methods removed
```

## Community Guidelines

### Communication

- **Be Respectful**: Treat all community members with respect
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Remember that everyone is learning and contributing in their own time
- **Ask Questions**: Don't hesitate to ask for help or clarification

### Where to Get Help

1. **[OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)** - Primary communication channel
   - `#general` - General discussions
   - `#development` - Development questions
   - `#help` - Getting help with issues

2. **GitHub Issues** - Bug reports and feature requests
3. **GitHub Discussions** - Longer form discussions and RFCs

### Reporting Issues

**Bug Reports:**
```markdown
## Bug Report

**Description**
A clear description of the bug.

**Steps to Reproduce**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior** 
What should have happened.

**Actual Behavior**
What actually happened.

**Environment**
- OS: [e.g. Ubuntu 20.04]
- Java Version: [e.g. OpenJDK 21]
- Application Version: [e.g. 5.32.0]

**Additional Context**
Any other relevant information.
```

**Feature Requests:**
```markdown
## Feature Request

**Problem Statement**
What problem does this feature solve?

**Proposed Solution**
How would you like this problem to be solved?

**Alternatives Considered**
What other approaches have you considered?

**Additional Context**
Any other relevant information or examples.
```

## Recognition

Contributors are recognized in several ways:

- **Contributors List**: Updated in README.md
- **Release Notes**: Contributors credited for their changes
- **Community Spotlights**: Featured in community communications
- **Maintainer Path**: Opportunity to become a maintainer

## Getting Started Checklist

Before making your first contribution:

- [ ] Read this contributing guide thoroughly
- [ ] Set up your development environment
- [ ] Join the OpenMSP Slack community
- [ ] Look for issues labeled `good first issue` or `help wanted`
- [ ] Fork the repository and create a feature branch
- [ ] Make a small test contribution (documentation fix, small bug fix)
- [ ] Submit your first pull request

## Next Steps

Ready to contribute? Here's what to do:

1. **Join the Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
2. **Find an Issue**: Browse [GitHub Issues](https://github.com/flamingo-stack/openframe-oss-lib/issues)
3. **Start Small**: Look for `good first issue` labels
4. **Ask Questions**: Don't hesitate to ask for help in Slack

---

*Thank you for contributing to OpenFrame OSS Libraries! Your contributions help build the future of open-source MSP tooling.*