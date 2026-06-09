# Contributing Guidelines

Thank you for contributing to `openframe-oss-lib`! This document covers code style, branching strategy, commit conventions, and the pull request process.

---

## Getting Started

Before contributing:

1. Set up your [development environment](../setup/environment.md)
2. Follow the [local development guide](../setup/local-development.md) to build and test locally
3. Join the [OpenMSP Slack community](https://www.openmsp.ai/) for discussion and guidance

> **All discussions, questions, and feature requests** are managed on [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA). There are no GitHub Issues or Discussions on this repository.

---

## Code Style and Conventions

### Java Style

The project follows standard Java conventions with some OpenFrame-specific patterns:

| Convention | Rule |
|-----------|------|
| **Lombok** | Use `@Data`, `@Builder`, `@Slf4j`, `@RequiredArgsConstructor` freely |
| **Immutability** | Prefer `final` fields; use Lombok `@Value` for pure DTOs |
| **Package structure** | Follow existing `com.openframe.*` package hierarchy |
| **Naming** | `*Service` for business logic, `*Repository` for data access, `*Controller` for REST, `*DataFetcher` for GraphQL |
| **Exception handling** | Throw from the `openframe-exception` hierarchy (`NotFoundException`, `BadRequestException`, etc.) |
| **Logging** | Use `@Slf4j` (Lombok); log at `DEBUG` for operations, `WARN`/`ERROR` for unexpected states |

### Lombok Usage

```java
// Preferred patterns
@Data                        // Getters, setters, equals, hashCode, toString
@Builder                     // Builder pattern for DTOs
@Value                       // Immutable value objects
@Slf4j                       // Logger injection
@RequiredArgsConstructor     // Constructor injection
@NoArgsConstructor           // For JPA/MongoDB entities

// Example service class
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

### GraphQL DataFetcher Conventions

```java
// Use @DgsComponent, @DgsQuery, @DgsMutation annotations
// Follow existing DataFetcher naming patterns
@DgsComponent
public class DeviceDataFetcher {

    @DgsQuery
    public GenericConnection<DeviceNode> devices(
            @InputArgument DeviceFilterInput filter,
            @InputArgument ConnectionArgs connectionArgs) {
        // ...
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

    private String tenantId;   // ← Required
    // ...
}

// 2. Have a compound index including tenantId
// (defined in MongoIndexConfig)
```

---

## Branch Naming

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
# Example: Create a feature branch
git checkout -b feat/add-device-tagging-bulk-update

# Example: Create a fix branch
git checkout -b fix/cassandra-tenant-scope-query
```

---

## Commit Message Format

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

### Examples

```text
feat(api): add bulk device tag assignment endpoint

Adds GraphQL mutation for bulk assignment of tags to multiple
devices in a single operation. Includes DataLoader optimization
to prevent N+1 on tag resolution.

fix(data): correct cursor encoding for notification pagination

The cursor codec was using unstable field order causing
inconsistent pagination results. Now uses deterministic
JSON serialization.

chore(deps): upgrade Spring Boot to 3.3.1

Addresses CVE-2024-XXXX in spring-web.
```

---

## Pull Request Process

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

Reviewers should verify:

- [ ] Code follows OpenFrame conventions (naming, Lombok, tenant scoping)
- [ ] New endpoints have appropriate `@PreAuthorize` or security config
- [ ] No N+1 query problems (DataLoaders used for related entity loading)
- [ ] Integration tests cover the happy path
- [ ] Error cases return appropriate exceptions from `openframe-exception`
- [ ] Multi-tenant isolation maintained (tenantId filters present)

---

## Module Addition Guidelines

When adding a new module to `openframe-oss-lib`:

1. **Add to parent `pom.xml`** in the `<modules>` section
2. **Inherit from parent**: `<parent>openframe-oss-lib</parent>`
3. **Add to `<dependencyManagement>`** in parent POM with `${revision}` version
4. **Follow naming convention**: `openframe-<domain>-<layer>`
5. **Include a `README.md`** describing the module's purpose
6. **Write at least one unit test** before the first PR

---

## Getting Help

- **Questions**: Ask in [OpenMSP Slack](https://www.openmsp.ai/) `#dev-questions`
- **Feature Ideas**: Share in `#roadmap` channel
- **Bug Reports**: Report in `#bugs` channel

We review contributions regularly. Thank you for helping build the open-source MSP platform of the future!
