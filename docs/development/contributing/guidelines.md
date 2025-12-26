# Contributing Guidelines

Welcome to the OpenFrame OSS Library contributor community! This guide outlines our development standards, workflow processes, and review criteria to help you make meaningful contributions to the project.

## 🎯 Contributing Philosophy

OpenFrame follows these core principles for contributions:

- **Quality over Quantity**: Well-crafted, tested code that follows established patterns
- **Documentation First**: All contributions include comprehensive documentation
- **Community Driven**: Decisions are made transparently with community input
- **Backward Compatibility**: Changes maintain API compatibility whenever possible

## 📋 Prerequisites for Contributing

Before making your first contribution, ensure you have:

- ✅ **Completed Setup**: Followed [Environment Setup](../setup/environment.md) and [Local Development](../setup/local-development.md)
- ✅ **Read Architecture**: Understood the [Architecture Overview](../architecture/overview.md)
- ✅ **Joined Community**: Active in [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)
- ✅ **Explored Codebase**: Familiarized yourself with existing patterns and tests

## 🔄 Development Workflow

### 1. Planning Your Contribution

**Before Writing Code:**
1. **Check Existing Issues**: Look for related issues or discussions
2. **Discuss in Slack**: Use `#contributors` channel for design discussions  
3. **Create Issue**: For substantial changes, create an issue first
4. **Get Alignment**: Ensure your approach aligns with project goals

**For Bug Fixes:**
- Can proceed directly with fix and tests
- Reference issue number in commit message

**For New Features:**
- **Must** discuss in Slack first
- Create design document for complex features
- Get maintainer approval before implementation

### 2. Git Workflow

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR-USERNAME/openframe-oss-lib.git
cd openframe-oss-lib

# 2. Add upstream remote
git remote add upstream https://github.com/openframe/openframe-oss-lib.git

# 3. Create feature branch from main
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name

# 4. Make your changes
# ... develop, test, document ...

# 5. Commit with conventional commit format
git add .
git commit -m "feat(api-lib): add device filtering by compliance status

- Add ComplianceStatus enum to device DTOs
- Implement filtering logic in DeviceFilters
- Add validation for compliance status values
- Include comprehensive unit tests

Closes #123"

# 6. Push to your fork
git push origin feature/your-feature-name

# 7. Create pull request from GitHub UI
```

### 3. Branch Naming Conventions

| Type | Format | Example |
|------|--------|---------|
| **Feature** | `feature/description` | `feature/device-compliance-filtering` |
| **Bug Fix** | `bugfix/description` | `bugfix/pagination-cursor-encoding` |
| **Documentation** | `docs/description` | `docs/update-api-examples` |
| **Refactoring** | `refactor/description` | `refactor/service-layer-organization` |
| **Performance** | `perf/description` | `perf/optimize-device-queries` |

## ✍️ Code Style and Conventions

### Java Code Standards

**1. Formatting and Structure**
```java
// Use 4 spaces for indentation (no tabs)
// Maximum line length: 120 characters
// Use descriptive variable and method names

@Service
public class DeviceServiceImpl implements DeviceService {
    
    private static final int DEFAULT_PAGE_SIZE = 25;
    private static final String DEVICE_NOT_FOUND_MESSAGE = "Device not found with ID: %s";
    
    private final DeviceRepository deviceRepository;
    private final DeviceMapper deviceMapper;
    private final OrganizationService organizationService;
    
    public DeviceServiceImpl(DeviceRepository deviceRepository,
                            DeviceMapper deviceMapper,
                            OrganizationService organizationService) {
        this.deviceRepository = deviceRepository;
        this.deviceMapper = deviceMapper;
        this.organizationService = organizationService;
    }
    
    @Override
    @Transactional(readOnly = true)
    public CountedGenericQueryResult<Device> findDevices(DeviceFilterInput input) {
        validateDeviceFilterInput(input);
        
        DeviceQueryFilter queryFilter = deviceMapper.toQueryFilter(input);
        Page<DeviceDocument> devicePage = deviceRepository.findDevicesWithFilters(queryFilter);
        
        List<Device> devices = deviceMapper.toDeviceList(devicePage.getContent());
        CursorPageInfo pageInfo = buildPageInfo(devicePage, input.getPagination());
        
        return CountedGenericQueryResult.<Device>builder()
            .items(devices)
            .totalCount(devicePage.getTotalElements())
            .pageInfo(pageInfo)
            .build();
    }
    
    private void validateDeviceFilterInput(DeviceFilterInput input) {
        if (input == null) {
            throw new IllegalArgumentException("Device filter input cannot be null");
        }
        
        if (input.getPagination() == null) {
            throw new IllegalArgumentException("Pagination input is required");
        }
    }
}
```

**2. Lombok Usage**
```java
// Prefer @Builder for DTOs and request objects
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceFilterInput {
    
    @Valid
    @NotNull(message = "Pagination is required")
    private CursorPaginationInput pagination;
    
    @Valid
    private DeviceFilters filters;
}

// Use @Value for immutable objects
@Value
@Builder
public class DeviceResponse {
    @NotNull
    String id;
    
    @NotNull
    String name;
    
    @NotNull
    DeviceType deviceType;
    
    @NotNull
    DeviceStatus status;
    
    List<String> tags;
    
    @NotNull
    LocalDateTime createdAt;
    
    @NotNull
    LocalDateTime updatedAt;
}
```

**3. Validation Annotations**
```java
// Use comprehensive validation on all DTOs
public class CreateDeviceRequest {
    
    @NotBlank(message = "Device name is required")
    @Size(min = 2, max = 100, message = "Device name must be between 2 and 100 characters")
    private String name;
    
    @NotNull(message = "Device type is required")
    private DeviceType deviceType;
    
    @NotNull(message = "Organization ID is required")
    @Pattern(regexp = "^[a-zA-Z0-9-_]+$", message = "Organization ID contains invalid characters")
    private String organizationId;
    
    @Valid
    private List<@NotBlank String> tags;
}
```

### Documentation Standards

**1. JavaDoc for Public APIs**
```java
/**
 * Service interface for managing devices within organizations.
 * 
 * <p>Provides operations for querying, creating, updating, and deleting devices
 * with proper multi-tenant isolation and pagination support.</p>
 *
 * @author OpenFrame Contributors
 * @since 1.0.0
 */
public interface DeviceService {
    
    /**
     * Finds devices based on provided filter criteria with pagination.
     * 
     * <p>This method supports:
     * <ul>
     *   <li>Cursor-based pagination for efficient large dataset navigation</li>
     *   <li>Filtering by device type, status, tags, and organization</li>
     *   <li>Multi-tenant isolation (automatically scoped to organization)</li>
     * </ul>
     *
     * @param input the filter input containing pagination and filter criteria
     * @return paginated result containing devices and pagination info
     * @throws IllegalArgumentException if input is null or invalid
     * @throws SecurityException if user lacks permission to access organization
     * 
     * @since 1.0.0
     */
    CountedGenericQueryResult<Device> findDevices(DeviceFilterInput input);
    
    /**
     * Retrieves a single device by its unique identifier.
     *
     * @param deviceId the unique device identifier
     * @return the device if found
     * @throws DeviceNotFoundException if no device exists with the given ID
     * @throws SecurityException if user lacks permission to access the device
     * 
     * @since 1.0.0
     */
    Device findDeviceById(String deviceId);
}
```

**2. Class-Level Documentation**
```java
/**
 * MongoDB document representing a device in the OpenFrame system.
 * 
 * <p>Devices represent managed endpoints such as workstations, servers, 
 * mobile devices, and IoT devices. Each device belongs to an organization
 * and can have multiple associated tools and monitoring agents.</p>
 * 
 * <p>This entity supports:</p>
 * <ul>
 *   <li>Multi-tenant data isolation via organizationId</li>
 *   <li>Flexible metadata storage for tool-specific information</li>
 *   <li>Tag-based categorization and filtering</li>
 *   <li>Compliance tracking and security monitoring</li>
 * </ul>
 *
 * @since 1.0.0
 */
@Document(collection = "devices")
@CompoundIndex(name = "org_status_idx", def = "{'organizationId': 1, 'status': 1}")
@CompoundIndex(name = "org_type_idx", def = "{'organizationId': 1, 'deviceType': 1}")
public class Device {
    // Implementation
}
```

## 🧪 Writing Tests

### Test Requirements

**Every contribution must include:**
- ✅ **Unit tests** for all new business logic
- ✅ **Integration tests** for API endpoints
- ✅ **Repository tests** for data operations  
- ✅ **Validation tests** for DTOs
- ✅ **Edge case coverage** (null inputs, boundary conditions)

### Test Naming and Structure

```java
@DisplayName("DeviceService Implementation Tests")
class DeviceServiceImplTest {
    
    @Nested
    @DisplayName("Device Retrieval")
    class DeviceRetrieval {
        
        @Test
        @DisplayName("Should find devices with valid filters successfully")
        void shouldFindDevicesWithValidFiltersSuccessfully() {
            // Given
            DeviceFilterInput validInput = createValidDeviceFilterInput();
            Page<DeviceDocument> expectedPage = createMockDevicePage();
            List<Device> expectedDevices = createExpectedDevices();
            
            when(deviceRepository.findDevicesWithFilters(any())).thenReturn(expectedPage);
            when(deviceMapper.toDeviceList(any())).thenReturn(expectedDevices);
            
            // When
            CountedGenericQueryResult<Device> result = deviceService.findDevices(validInput);
            
            // Then
            assertThat(result).isNotNull();
            assertThat(result.getItems()).hasSize(2);
            assertThat(result.getTotalCount()).isEqualTo(10L);
            
            verify(deviceRepository).findDevicesWithFilters(any());
            verify(deviceMapper).toDeviceList(any());
        }
        
        @ParameterizedTest
        @DisplayName("Should reject invalid filter inputs")
        @MethodSource("invalidFilterInputs")
        void shouldRejectInvalidFilterInputs(DeviceFilterInput invalidInput, String expectedMessage) {
            // When & Then
            assertThatThrownBy(() -> deviceService.findDevices(invalidInput))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(expectedMessage);
            
            verifyNoInteractions(deviceRepository);
        }
        
        private static Stream<Arguments> invalidFilterInputs() {
            return Stream.of(
                Arguments.of(null, "Device filter input cannot be null"),
                Arguments.of(DeviceFilterInput.builder().build(), "Pagination input is required"),
                Arguments.of(DeviceFilterInput.builder()
                    .pagination(CursorPaginationInput.builder().limit(0).build())
                    .build(), "Limit must be at least 1")
            );
        }
    }
    
    @Nested
    @DisplayName("Error Handling")
    class ErrorHandling {
        
        @Test
        @DisplayName("Should handle repository exceptions gracefully")
        void shouldHandleRepositoryExceptionsGracefully() {
            // Given
            DeviceFilterInput input = createValidDeviceFilterInput();
            when(deviceRepository.findDevicesWithFilters(any()))
                .thenThrow(new RuntimeException("Database connection failed"));
            
            // When & Then
            assertThatThrownBy(() -> deviceService.findDevices(input))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Database connection failed");
        }
    }
}
```

### Integration Test Standards

```java
@SpringBootTest
@Testcontainers
@DisplayName("Device API Integration Tests")
class DeviceApiIntegrationTest {
    
    @Container
    static MongoDBContainer mongoDBContainer = new MongoDBContainer("mongo:7");
    
    @Autowired
    private TestRestTemplate restTemplate;
    
    @Test
    @DisplayName("Should create and retrieve device successfully")
    void shouldCreateAndRetrieveDeviceSuccessfully() {
        // Given
        CreateDeviceRequest createRequest = CreateDeviceRequest.builder()
            .name("Integration Test Device")
            .deviceType(DeviceType.DESKTOP)
            .organizationId("test-org-123")
            .tags(Arrays.asList("test", "integration"))
            .build();
        
        // When - Create device
        ResponseEntity<DeviceResponse> createResponse = restTemplate.postForEntity(
            "/api/devices", createRequest, DeviceResponse.class);
        
        // Then - Verify creation
        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(createResponse.getBody()).isNotNull();
        
        String deviceId = createResponse.getBody().getId();
        
        // When - Retrieve device
        ResponseEntity<DeviceResponse> getResponse = restTemplate.getForEntity(
            "/api/devices/" + deviceId, DeviceResponse.class);
        
        // Then - Verify retrieval
        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        DeviceResponse device = getResponse.getBody();
        assertThat(device.getName()).isEqualTo("Integration Test Device");
        assertThat(device.getDeviceType()).isEqualTo(DeviceType.DESKTOP);
        assertThat(device.getTags()).containsExactlyInAnyOrder("test", "integration");
    }
}
```

## 📝 Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) for consistent commit history and automated changelog generation.

### Commit Message Structure

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | Description | Example |
|------|-------------|---------|
| **feat** | New feature | `feat(api-lib): add device compliance filtering` |
| **fix** | Bug fix | `fix(pagination): handle null cursor values correctly` |
| **docs** | Documentation only | `docs(contributing): update code style guidelines` |
| **style** | Code style changes | `style(device-service): fix formatting and imports` |
| **refactor** | Code refactoring | `refactor(repository): extract common query logic` |
| **perf** | Performance improvement | `perf(device-query): optimize MongoDB aggregation` |
| **test** | Test changes | `test(device-service): add edge case coverage` |
| **chore** | Build/tools changes | `chore(deps): update Spring Boot to 3.2.1` |

### Commit Examples

**Good Commits:**
```bash
# Feature addition
feat(api-lib): add device health monitoring DTOs

- Add DeviceHealth entity with vitals tracking
- Include HealthStatus enum and validation rules
- Support for CPU, memory, disk metrics
- Add comprehensive unit tests for new DTOs

Closes #234

# Bug fix
fix(cursor-pagination): handle edge case with empty result sets

Previously, empty result sets would return null cursor causing
NPE in subsequent pagination requests. Now returns appropriate
empty state with hasNext=false.

Fixes #189

# Documentation
docs(architecture): add sequence diagrams for authentication flow

- Add OAuth2 authentication sequence
- Include JWT validation process
- Document error handling patterns
- Update architecture overview with new diagrams
```

**Avoid These Patterns:**
```bash
# Too vague
fix: bug fix

# No description
feat(api): stuff

# Not following format
Added new feature for devices

# Multiple unrelated changes
feat: add device filtering and fix user authentication and update docs
```

## 🔍 Pull Request Process

### Before Creating a PR

1. **Self Review Checklist:**
   - [ ] Code follows style guidelines
   - [ ] All tests pass locally  
   - [ ] Documentation is updated
   - [ ] Commit messages follow conventions
   - [ ] No merge conflicts with main branch

2. **Testing Checklist:**
   - [ ] Unit tests cover new functionality
   - [ ] Integration tests validate API changes
   - [ ] Manual testing performed
   - [ ] Performance impact assessed

### Pull Request Template

```markdown
## Description
Brief description of changes and their purpose.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated  
- [ ] Manual testing performed
- [ ] Performance testing completed (if applicable)

## Screenshots (if applicable)
Include screenshots for UI changes or API response examples.

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or my feature works
- [ ] New and existing unit tests pass locally with my changes

## Related Issues
Closes #123
Related to #456
```

### Review Process

**Automatic Checks:**
- ✅ All tests pass
- ✅ Code coverage meets thresholds  
- ✅ No security vulnerabilities
- ✅ Code style validation
- ✅ Documentation builds successfully

**Manual Review Focuses On:**
- **Architecture Consistency**: Follows established patterns
- **API Design**: RESTful, consistent with existing endpoints
- **Security**: Proper validation, authorization, data handling
- **Performance**: Efficient queries, appropriate caching
- **Testability**: Adequate test coverage and quality
- **Documentation**: Clear, comprehensive, accurate

### Addressing Review Feedback

```bash
# Make requested changes
git add .
git commit -m "fix: address review feedback

- Update validation error messages per reviewer feedback
- Extract common validation logic to utility method
- Add missing edge case test for null organization ID"

# Push changes
git push origin feature/your-feature-name

# PR will automatically update
```

## 🚀 Release Process

### Semantic Versioning

OpenFrame follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes to public API
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, backward compatible

### Contribution Impact

| Change Type | Version Impact | Examples |
|-------------|----------------|----------|
| **Bug fixes** | PATCH | Fix pagination edge case, correct validation message |
| **New features** | MINOR | Add device filtering, new API endpoint |
| **Breaking changes** | MAJOR | Change DTO structure, remove deprecated method |
| **Documentation** | None | Update guides, fix typos |

## 🎨 Advanced Contributing

### Creating New Modules

When adding significant functionality, consider creating a new module:

```text
openframe-new-module/
├── src/
│   ├── main/java/com/openframe/newmodule/
│   │   ├── dto/           # Data Transfer Objects
│   │   ├── service/       # Service interfaces and implementations  
│   │   ├── config/        # Configuration classes
│   │   └── exception/     # Module-specific exceptions
│   └── test/java/com/openframe/newmodule/
│       ├── service/       # Service tests
│       └── integration/   # Integration tests
├── pom.xml               # Module dependencies
└── README.md             # Module documentation
```

### Adding New Tool Integrations

For integrating new MSP tools:

1. **Create SDK Module** under `sdk/{tool-name}/`
2. **Define Tool Client** with proper error handling
3. **Add Integration Service** in appropriate service module
4. **Create Event Mappers** for tool-specific events
5. **Add Configuration** for tool connection settings

### Performance Optimization Contributions

When contributing performance improvements:

1. **Create Benchmark Tests** using JMH
2. **Document Performance Impact** with before/after metrics
3. **Consider Memory Usage** and GC impact
4. **Test Under Load** with realistic data volumes
5. **Monitor Database Performance** for query optimizations

## ❓ Getting Help

### Before Asking for Help

1. **Search Existing Issues** and discussions
2. **Check Documentation** including architecture guides
3. **Review Similar Code** in the codebase
4. **Test Locally** to isolate the issue

### Where to Get Help

| Question Type | Where to Ask | Expected Response Time |
|---------------|--------------|----------------------|
| **Quick Questions** | `#general` Slack channel | < 2 hours |
| **Technical Issues** | `#dev-help` Slack channel | < 4 hours |
| **Design Discussions** | `#contributors` Slack channel | < 1 day |
| **Bug Reports** | GitHub Issues | < 2 days |
| **Feature Requests** | GitHub Issues + Slack discussion | < 1 week |

### Effective Questions

**Good Question:**
```text
I'm implementing device filtering by compliance status and getting a 
MongoDB aggregation error: "FieldPath field names may not contain '.'". 

I'm trying to filter on 'compliance.status' field. Looking at existing 
filters in DeviceFilters.java, should I be using dot notation or a 
nested approach?

My current attempt:
```java
Query query = new Query(Criteria.where("compliance.status").is(status));
```

Has anyone solved similar nested field filtering?
```

**Avoid:**
```text
Device filtering doesn't work. Help?
```

## 📊 Contribution Recognition

### Contributor Levels

| Level | Criteria | Recognition |
|-------|----------|-------------|
| **First-Time Contributor** | Merged PR | Welcome message, contributor badge |
| **Regular Contributor** | 5+ merged PRs | Listed in CONTRIBUTORS.md |
| **Core Contributor** | 20+ PRs, design participation | Commit access, technical decisions |
| **Maintainer** | Long-term commitment | Release management, project direction |

### Monthly Contributor Spotlight

Outstanding contributors are featured monthly in:
- OpenMSP Slack announcements
- Release notes acknowledgments
- OpenFrame website contributor page

## 🎯 What's Next?

Ready to contribute? Here's your action plan:

1. **Join the Community**: [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) and introduce yourself
2. **Pick Your First Issue**: Look for "good first issue" labels
3. **Set Up Development**: Follow the [Local Development](../setup/local-development.md) guide
4. **Make Your First PR**: Start small with documentation or test improvements
5. **Engage with Reviews**: Learn from feedback and help review others' code

## 📚 Additional Resources

- **Spring Boot Best Practices**: [spring.io/guides](https://spring.io/guides)
- **MongoDB Java Driver**: [mongodb.github.io/mongo-java-driver/](https://mongodb.github.io/mongo-java-driver/)
- **Testing Patterns**: [martinfowler.com/articles/practical-test-pyramid.html](https://martinfowler.com/articles/practical-test-pyramid.html)
- **API Design Guidelines**: [restfulapi.net](https://restfulapi.net/)

---

**Thank you for contributing to OpenFrame!** Your efforts help build better MSP tools for the entire community. Let's create something amazing together! 🚀