<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shdrojejslhgnojzkzak.supabase.co/storage/v1/object/public/public/doc-orchestrator/logos/1771384787765-92lldo-logo-openframe-full-dark-bg.png">
    <source media="(prefers-color-scheme: light)" srcset="https://shdrojejslhgnojzkzak.supabase.co/storage/v1/object/public/public/doc-orchestrator/logos/1771384795200-4l8vh-logo-openframe-full-light-bg.png">
    <img alt="OpenFrame" src="https://shdrojejslhgnojzkzak.supabase.co/storage/v1/object/public/public/doc-orchestrator/logos/1771384795200-4l8vh-logo-openframe-full-light-bg.png" width="400">
  </picture>
</div>

# Contributing to OpenFrame OSS Lib

Thank you for contributing to `openframe-oss-lib`! This document covers everything you need to get started: code style conventions, branching strategy, commit message format, pull request process, and security guidelines.

---

## 📣 Community First

> **All discussions, questions, and feature requests** are managed on [OpenMSP Slack](https://www.openmsp.ai/).
> We do **not** use GitHub Issues or GitHub Discussions on this repository.

[![Join OpenMSP Slack](https://img.shields.io/badge/Slack-OpenMSP-blue?logo=slack)](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)

| Channel | Purpose |
|---------|---------|
| `#dev-questions` | Technical questions and help |
| `#roadmap` | Feature requests and ideas |
| `#bugs` | Bug reports and triage |

---

## 🚀 Getting Started

Before contributing:

1. Set up your [development environment](./docs/development/setup/environment.md)
2. Follow the [local development guide](./docs/development/setup/local-development.md) to build and test locally
3. Join the [OpenMSP Slack community](https://www.openmsp.ai/) for discussion and guidance

---

## 🛠️ Development Environment

### Prerequisites

| Tool | Version |
|------|---------|
| **Java (JDK)** | 21+ |
| **Apache Maven** | 3.8+ |
| **Git** | 2.x+ |
| **Docker** | 24.x+ (for integration tests) |
| **Node.js** | 18+ (for frontend-core only) |

### Setup

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Build all modules (skip tests for speed)
mvn install -DskipTests

# Run unit tests for a specific module
mvn test -pl openframe-core

# Run integration tests (requires Docker)
mvn verify -pl openframe-data-mongo-sync
```

### GitHub Packages Access

Add your credentials to `~/.m2/settings.xml`:

```xml
<settings>
  <servers>
    <server>
      <id>github</id>
      <username>YOUR_GITHUB_USERNAME</username>
      <password>YOUR_GITHUB_TOKEN</password>
    </server>
  </servers>
</settings>
```

---

## 🎨 Code Style and Conventions

### Java Style

| Convention | Rule |
|-----------|------|
| **Lombok** | Use `@Data`, `@Builder`, `@Slf4j`, `@RequiredArgsConstructor` freely |
| **Immutability** | Prefer `final` fields; use Lombok `@Value` for pure DTOs |
| **Package structure** | Follow existing `com.openframe.*` package hierarchy |
| **Naming** | `*Service` for business logic, `*Repository` for data access, `*Controller` for REST, `*DataFetcher` for GraphQL |
| **Exception handling** | Throw from the `openframe-exception` hierarchy (`NotFoundException`, `BadRequestException`, etc.) |
| **Logging** | Use `@Slf4j` (Lombok); log at `DEBUG` for operations, `WARN`/`ERROR` for unexpected states |

### Service Class Pattern

```java
@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceService {
    private final MachineRepository machineRepository;
    private final TenantIdProvider tenantIdProvider;

    public Optional<Machine> findDevice(String machineId) {
        log.debug("Looking up device: {}", machineId);
        return machineRepository.findByMachineId(
            machineId, tenantIdProvider.getTenantId()
        );
    }
}
```

### GraphQL DataFetcher Pattern

```java
@DgsComponent
public class DeviceDataFetcher {

    @DgsQuery
    public GenericConnection<DeviceNode> devices(
            @InputArgument DeviceFilterInput filter,
            @InputArgument ConnectionArgs connectionArgs) {
        // delegate to service layer
    }
}
```

### Multi-Tenancy Requirements

**Every new domain document must:**

```java
// 1. Implement TenantScoped
@Document(collection = "my_collection")
public class MyDocument implements TenantScoped {
    @Id
    private String id;

    private String tenantId; // Required for all domain documents
}
```

Also ensure a compound MongoDB index that includes `tenantId` is defined in the appropriate `MongoIndexConfig`.

---

## 🌿 Branch Naming

Use descriptive, hyphen-separated branch names with a type prefix:

| Prefix | Use Case | Example |
|--------|---------|---------|
| `feat/` | New features | `feat/add-webhook-support` |
| `fix/` | Bug fixes | `fix/notification-pagination-cursor` |
| `chore/` | Maintenance tasks | `chore/upgrade-spring-boot-3.4` |
| `refactor/` | Code refactoring | `refactor/device-service-split` |
| `docs/` | Documentation changes | `docs/update-auth-flow-diagram` |
| `test/` | Test additions/fixes | `test/add-ticket-repository-it` |

```bash
# Create a feature branch
git checkout -b feat/add-device-tagging-bulk-update

# Create a fix branch
git checkout -b fix/cassandra-tenant-scope-query
```

---

## 💬 Commit Message Format

Follow the **Conventional Commits** specification:

```text
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | When to Use |
|------|------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `chore` | Build, dependency, or tooling changes |
| `refactor` | Code restructure without behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation only changes |
| `perf` | Performance improvements |
| `ci` | CI/CD pipeline changes |

### Scope Examples

| Scope | Module |
|-------|--------|
| `core` | `openframe-core` |
| `gateway` | `openframe-gateway-service-core` |
| `auth` | `openframe-authorization-service-core` |
| `api` | `openframe-api-service-core` |
| `data` | `openframe-data-mongo-*` |
| `stream` | `openframe-stream-service-core` |
| `management` | `openframe-management-service-core` |
| `frontend` | `openframe-frontend-core` |
| `security` | `openframe-security-core` |

### Commit Examples

```text
feat(api): add bulk device tag assignment endpoint

Adds GraphQL mutation for bulk assignment of tags to multiple
devices in a single operation. Includes DataLoader optimization
to prevent N+1 on tag resolution.
```

```text
fix(data): correct cursor encoding for notification pagination

The cursor codec was using unstable field order causing
inconsistent pagination results. Now uses deterministic
JSON serialization.
```

```text
chore(deps): upgrade Spring Boot to 3.3.1

Addresses CVE-2024-XXXX in spring-web.
```

---

## 🔁 Pull Request Process

### Before Opening a PR

- [ ] Branch is up to date with `main`
- [ ] All unit tests pass: `mvn test`
- [ ] Relevant integration tests pass: `mvn verify -pl <module>`
- [ ] New code follows project conventions (Lombok, tenant scoping, etc.)
- [ ] New domain documents implement `TenantScoped`
- [ ] No secrets or hardcoded credentials in code
- [ ] Javadoc added for new public APIs

### PR Description Template

```text
## Summary
Brief description of what this PR does and why.

## Changes
- List key changes
- Affected modules: openframe-xxx, openframe-yyy

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manually tested against local stack

## Related
Link to Slack discussion or related PR (if any).
```

### Review Checklist

Reviewers verify:

- [ ] Code follows OpenFrame conventions (naming, Lombok, tenant scoping)
- [ ] New endpoints have appropriate `@PreAuthorize` or security config
- [ ] No N+1 query problems (DataLoaders used for related entity loading)
- [ ] Integration tests cover the happy path
- [ ] Error cases return appropriate exceptions from `openframe-exception`
- [ ] Multi-tenant isolation maintained (`tenantId` filters present)

---

## 📦 Adding a New Module

When adding a new module to `openframe-oss-lib`:

1. Add to parent `pom.xml` in the `<modules>` section
2. Inherit from parent: `<parent>openframe-oss-lib</parent>`
3. Add to `<dependencyManagement>` in parent POM with `${revision}` version
4. Follow naming convention: `openframe-<domain>-<layer>`
5. Include a `README.md` describing the module's purpose
6. Write at least one unit test before the first PR

---

## 🔒 Security Guidelines

### Secrets Management

Never hardcode secrets in source code or configuration files. Always use environment variables:

```bash
# Correct: use environment variables
export SPRING_DATA_MONGODB_URI=mongodb://user:secret@host/db
```

Never commit `.env` files or any file containing credentials to version control.

### Multi-Tenant Safety Checklist

For any new data-access code:

- [ ] Document implements `TenantScoped`
- [ ] Repository queries include `tenantId` filter
- [ ] Custom repository implementations use `TenantIdProvider`
- [ ] Compound index includes `{ tenantId: 1, ... }`

### Input Validation

All API inputs must use Jakarta Bean Validation constraints:

```java
@NotNull
private String machineId;

@Positive
private Integer timeoutSeconds;
```

### API Key Best Practices

- Rotate API keys regularly using `ApiKeyController`
- Store keys encrypted using `EncryptionService` from `openframe-core-crypto`
- Never log API key values — only log key IDs
- Apply appropriate `APIKeyType` scope

---

## 🧪 Testing Guidelines

### Test Structure

| Pattern | Type | Requirement |
|---------|------|-------------|
| `*Test.java` | Unit test | No Docker; runs in `mvn test` |
| `*IT.java` | Integration test | Requires Docker; runs in `mvn verify` |

### Unit Test Example

```java
class SlugUtilTest {

    @Test
    void shouldConvertNameToSlug() {
        String name = "My MSP Organization";
        String slug = SlugUtil.toSlug(name);
        assertThat(slug).isEqualTo("my-msp-organization");
    }
}
```

### Integration Test Example

```java
@SpringBootTest
@Testcontainers
class OrganizationRepositoryIT extends BaseMongoIntegrationTest {

    @Autowired
    private OrganizationRepository organizationRepository;

    @Test
    void shouldSaveAndRetrieveOrganization() {
        Organization org = new Organization();
        org.setTenantId("oss");
        org.setName("Test MSP");

        Organization saved = organizationRepository.save(org);

        assertThat(saved.getId()).isNotNull();
    }
}
```

### Speed Up Integration Tests

```bash
# Enable Testcontainers container reuse
echo "testcontainers.reuse.enable=true" >> ~/.testcontainers.properties
```

### Coverage Guidelines

| Code Type | Coverage Target |
|-----------|----------------|
| Domain services | 80%+ unit test coverage |
| Utility classes | 90%+ unit test coverage |
| Repository custom implementations | Integration test coverage |
| Controllers / DataFetchers | Integration test coverage |

---

## 📖 Documentation

For deeper reference on development workflows, see the [Development Documentation](./docs/development/README.md).

---

<div align="center">
  Built with 💛 by the <a href="https://www.flamingo.run/about"><b>Flamingo</b></a> team
</div>
