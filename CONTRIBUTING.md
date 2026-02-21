# Contributing to OpenFrame OSS Libraries

Welcome to OpenFrame OSS Libraries! We're excited to have you contribute to the future of open-source MSP tooling and AI-driven automation. This guide covers everything you need to know to make meaningful contributions to the project.

## 🚀 Quick Start for Contributors

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/openframe-oss-lib.git
cd openframe-oss-lib

# Add upstream remote for staying in sync
git remote add upstream https://github.com/flamingo-stack/openframe-oss-lib.git
```

### 2. Set Up Development Environment

```bash
# Install dependencies and build all modules
mvn clean install

# Start development services with Docker
docker-compose -f docker-compose.dev.yml up -d

# Run the main API service
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

## 🎯 Ways to Contribute

### 🐛 Bug Reports and Fixes
- Report bugs using [GitHub Issues](https://github.com/flamingo-stack/openframe-oss-lib/issues)
- Fix bugs with clear, focused pull requests
- Include reproduction steps and test cases

### ✨ New Features  
- Propose new features in [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) first
- Implement features that align with the OpenFrame roadmap
- Ensure backward compatibility and proper documentation

### 📚 Documentation
- Improve existing documentation
- Add code examples and tutorials
- Update API documentation for changes
- Translate documentation to other languages

### 🧪 Testing and Quality
- Add or improve unit tests (target 80% coverage)
- Write integration tests for new features
- Improve error handling and edge cases
- Performance testing and optimization

## 📋 Development Standards

### Code Style and Conventions

**Follow Google Java Style Guide** with these OpenFrame-specific standards:

```java
// ✅ GOOD: Proper class structure with OpenFrame patterns
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

### Critical Security Requirements

**⚠️ CRITICAL: All endpoints MUST enforce tenant isolation**

```java
// ✅ CORRECT: Enforces tenant isolation
@GetMapping("/{id}")
public Organization get(
    @PathVariable String id,
    @AuthenticationPrincipal AuthPrincipal principal
) {
    return repository.findByTenantIdAndId(principal.getTenantId(), id)
        .orElseThrow(() -> new OrganizationNotFoundException(id));
}

// ❌ WRONG: Can access any tenant's data
@GetMapping("/{id}")
public Organization get(@PathVariable String id) {
    return repository.findById(id).orElseThrow();  // SECURITY VIOLATION
}
```

**Security Checklist for All Contributions:**
- [ ] Tenant isolation enforced in all database queries
- [ ] Input validation implemented using `@Valid` and custom validators
- [ ] Authentication required for all protected endpoints
- [ ] Sensitive data not logged or exposed in error messages
- [ ] SQL injection prevention (use parameterized queries)

## 📝 Git Workflow

### Branch Naming Convention

```bash
# Feature branches
git checkout -b feature/add-organization-search
git checkout -b feature/implement-google-sso

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
# Types: feat, fix, docs, style, refactor, test, chore
# Scope: module or area (optional)
# Description: imperative, present tense

# Examples:
git commit -m "feat(auth): add support for Google SSO integration"
git commit -m "fix(security): resolve tenant isolation vulnerability in organization API"
git commit -m "docs(api): update GraphQL schema documentation"
git commit -m "refactor(service): extract common pagination logic"  
git commit -m "test(integration): add comprehensive organization controller tests"
git commit -m "chore(deps): upgrade Spring Boot to 3.3.1"
```

## 🧪 Testing Requirements

### Test Coverage Standards

**Minimum Requirements:**
- **Unit Tests**: 80% line coverage, 75% branch coverage
- **Integration Tests**: Cover all API endpoints and critical business flows  
- **Security Tests**: Verify tenant isolation, authentication, and authorization

### Required Tests for New Features

```java
// 1. Unit Tests - Test business logic in isolation
@ExtendWith(MockitoExtension.class)
class OrganizationServiceTest {
    
    @Test
    @DisplayName("Should create organization with valid data")
    void shouldCreateOrganizationWithValidData() {
        // Given
        CreateOrganizationRequest request = CreateOrganizationRequest.builder()
            .name("Test Organization")
            .build();
        String tenantId = "tenant-123";
        
        // When & Then - test implementation
    }
    
    @Test
    @DisplayName("Should throw exception when organization name already exists")
    void shouldThrowExceptionWhenNameExists() {
        // Test duplicate name handling
    }
}

// 2. Integration Tests - Full request/response cycle
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OrganizationControllerIntegrationTest {
    
    @Test
    @DisplayName("Should create organization via REST API")
    void shouldCreateOrganizationViaRestApi() {
        // Test complete API workflow
    }
}

// 3. Security Tests - Critical for multi-tenant applications
@SpringBootTest
class OrganizationSecurityTest {
    
    @Test
    @DisplayName("Should enforce tenant isolation")
    void shouldEnforceTenantIsolation() {
        // Verify tenant A cannot access tenant B's data
    }
}
```

### Running Tests

```bash
# Run all tests
mvn clean verify

# Run specific test categories
mvn test -Dgroups=unit                    # Unit tests only
mvn test -Dgroups=integration             # Integration tests only
mvn test -Dgroups=security                # Security tests only

# Run tests with coverage
mvn clean verify -Pcoverage
open target/site/jacoco/index.html       # View coverage report
```

## 📖 Documentation Requirements

### Code Documentation

**JavaDoc is required for:**
- All public classes and interfaces
- All public methods with parameters and return values  
- Complex business logic and algorithms
- Security-related code

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

### API Documentation

Update API documentation for:
- New REST endpoints and GraphQL queries/mutations
- Changes to existing API contracts
- New DTOs, data models, and error responses  
- Authentication and authorization requirements

## 🔄 Pull Request Process

### Before Creating PR

```bash
# Ensure your branch is up to date
git fetch upstream
git rebase upstream/main

# Run full test suite
mvn clean verify

# Check code style
mvn checkstyle:check  

# Run security analysis
mvn spotbugs:check
```

### PR Title and Description

**Title Format:**
```
feat(auth): implement Google SSO integration
fix(security): resolve tenant data leakage in API endpoints  
docs(development): add testing guidelines and best practices
```

**Description Template:**
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
- [ ] Security tests added/updated (for multi-tenant changes)
- [ ] Manual testing completed
- [ ] All existing tests pass

## Security Considerations
- [ ] Changes reviewed for security implications
- [ ] Tenant isolation maintained  
- [ ] Input validation implemented
- [ ] Authentication/authorization properly handled
- [ ] No sensitive data exposed in logs or errors

## Performance Considerations
- [ ] Database queries optimized (no N+1 issues)
- [ ] Caching strategy considered
- [ ] Memory usage reviewed for large datasets
- [ ] API response times tested

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated (API docs, README, etc.)
- [ ] No breaking changes without proper migration path
- [ ] Backward compatibility maintained

## Related Issues
Fixes #123
Relates to #456
```

### Review Process

**For Contributors:**
- Address all review comments promptly and professionally
- Keep discussions focused on the technical implementation
- Update documentation and tests based on feedback
- Ensure CI passes before requesting re-review

**For Reviewers:**
- Focus on code quality, security, and maintainability
- Verify tenant isolation and security requirements
- Test changes locally for complex features
- Provide constructive, actionable feedback

## 🚫 Common Pitfalls to Avoid

### 1. Tenant Data Leakage (Critical Security Issue)

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
        .map(org -> new OrganizationWithDevices(org, 
            deviceRepository.findByOrganizationId(org.getId())))
        .collect(Collectors.toList());
}

// ✅ CORRECT: Single query with join or batch loading
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

// ✅ CORRECT: Proper validation and security
@PostMapping
public ResponseEntity<Organization> create(
    @Valid @RequestBody CreateOrganizationRequest request,
    @AuthenticationPrincipal AuthPrincipal principal
) {
    Organization org = service.create(request, principal.getTenantId());
    return ResponseEntity.status(HttpStatus.CREATED).body(org);
}
```

### 4. Information Leakage in Error Handling

```java
// ❌ WRONG: Could reveal information about other tenants
@ExceptionHandler(OrganizationNotFoundException.class)
public ResponseEntity<ErrorResponse> handleNotFound(OrganizationNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ErrorResponse("Organization " + ex.getId() + " not found"));
}

// ✅ CORRECT: Generic message, no information leakage  
@ExceptionHandler(OrganizationNotFoundException.class)
public ResponseEntity<ErrorResponse> handleNotFound(OrganizationNotFoundException ex) {
    ErrorResponse error = ErrorResponse.builder()
        .code("ORGANIZATION_NOT_FOUND")
        .message("Organization not found")
        .timestamp(Instant.now())
        .build();
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
}
```

## 🌍 Community Guidelines

### Communication Standards
- **Be Respectful**: Treat all community members with kindness and respect
- **Be Constructive**: Provide helpful feedback and actionable suggestions
- **Be Patient**: Remember that everyone is learning and contributing in their spare time
- **Ask Questions**: Don't hesitate to ask for help or clarification

### Where to Get Help

1. **[OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)** - Primary support channel
   - `#general` - General discussions and announcements
   - `#development` - Development questions and technical discussions  
   - `#help` - Getting help with setup and issues

2. **GitHub Issues** - Bug reports and feature requests with templates
3. **GitHub Discussions** - Longer-form discussions, RFCs, and architectural decisions

### Reporting Issues

**Bug Report Template:**
```markdown
## Bug Report

**Description**  
Clear description of the issue.

**Steps to Reproduce**
1. Step 1
2. Step 2  
3. Step 3

**Expected Behavior**
What should have happened.

**Actual Behavior**
What actually happened.

**Environment**
- OS: [e.g. Ubuntu 22.04]
- Java Version: [e.g. OpenJDK 21.0.1]
- Application Version: [e.g. 5.32.0]
- Database Versions: [MongoDB, Redis, etc.]

**Security Impact**  
Does this affect tenant isolation or data security?

**Additional Context**
Logs, screenshots, or other relevant information.
```

## 🏆 Recognition and Growth

### Recognition
Contributors are recognized through:
- **Contributors List**: Maintained in README.md
- **Release Notes**: Contributors credited for their changes
- **Community Spotlights**: Featured in Slack and social media
- **Conference Speaking**: Opportunities to present work at events

### Path to Maintainer
Regular contributors can become maintainers by:
1. Demonstrating consistent, high-quality contributions
2. Showing deep understanding of the codebase and architecture  
3. Helping other contributors and community members
4. Participating in architectural discussions and decisions

## 🎯 Getting Started Checklist

Before making your first contribution:

- [ ] Read this contributing guide thoroughly
- [ ] Set up your development environment following the prerequisites  
- [ ] Join the [OpenMSP Slack community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- [ ] Look for issues labeled `good first issue` or `help wanted`
- [ ] Fork the repository and create a feature branch
- [ ] Make a small test contribution (documentation fix, small bug fix)
- [ ] Submit your first pull request and engage with reviewers

## 📚 Additional Resources

- **[Development Setup Guide](./docs/development/setup/local-development.md)** - Detailed environment configuration
- **[Architecture Overview](./docs/reference/architecture/README.md)** - Understanding the system design
- **[API Documentation](./docs/api/README.md)** - REST and GraphQL API references
- **[Security Guidelines](./docs/development/security/README.md)** - Security best practices

## 🚀 Ready to Contribute?

1. **Join the Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
2. **Find an Issue**: Browse [GitHub Issues](https://github.com/flamingo-stack/openframe-oss-lib/issues) 
3. **Start Small**: Look for `good first issue` labels
4. **Ask Questions**: Don't hesitate to ask for help in `#development` channel

---

*Thank you for contributing to OpenFrame OSS Libraries! Your contributions help build the future of open-source MSP tooling and AI-driven automation.* 🙏