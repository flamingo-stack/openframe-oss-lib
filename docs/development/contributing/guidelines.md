# Contributing Guidelines

Thank you for contributing to **openframe-oss-lib**! This guide covers code style, branching strategy, commit conventions, and the pull request process.

---

## Community First

All contribution discussions happen on the [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA). We do **not** use GitHub Issues or GitHub Discussions.

Before starting a large contribution:
1. Join the [OpenMSP Slack](https://www.openmsp.ai/)
2. Describe what you're planning in the `#openframe-dev` channel
3. Get feedback from maintainers before investing significant effort

---

## Code Style and Conventions

### Java Style

The project follows standard Java conventions with the following specifics:

| Convention | Rule |
|-----------|------|
| Indentation | 4 spaces (no tabs) |
| Line length | Max 120 characters |
| Imports | No wildcard imports; organize by static → java → jakarta → spring → other |
| Braces | Allman-adjacent style (opening brace on same line) |
| Naming | `camelCase` methods/fields, `PascalCase` classes, `UPPER_SNAKE` constants |

### Lombok Usage

Use Lombok to reduce boilerplate. Preferred annotations:

```java
// Prefer these
@Data          // getters, setters, equals, hashCode, toString
@Value         // immutable value objects
@Builder       // fluent builders
@RequiredArgsConstructor  // constructor injection
@Slf4j         // logging

// Avoid manual getters/setters when @Data or @Value apply
```

### Spring Boot Conventions

- Use constructor injection (via `@RequiredArgsConstructor`) over field injection (`@Autowired`)
- Prefer `@ConfigurationProperties` over `@Value` for configuration
- Use `@Service`, `@Repository`, `@Component`, `@Controller` consistently
- Configuration classes should be annotated with `@Configuration`

```java
// Correct: Constructor injection
@Service
@RequiredArgsConstructor
public class MyService {
    private final MyRepository repository;
    private final AnotherService anotherService;
}

// Avoid: Field injection
@Service
public class MyService {
    @Autowired
    private MyRepository repository;
}
```

### Multi-Tenancy Requirements

Every service and repository method that accesses tenant-scoped data **must** include `tenantId` in queries:

```java
// Correct: Always scope to tenant
Optional<Organization> findByIdAndTenantId(String id, String tenantId);

// Wrong: Missing tenant scope
Optional<Organization> findById(String id); // Never use for tenant-scoped data
```

### Exception Handling

Use the standard exception hierarchy from `openframe-exception`:

```java
// Use specific exception types
throw new NotFoundException("Organization not found: " + id);
throw new BadRequestException("Invalid email format");
throw new ForbiddenException("Access denied for tenant: " + tenantId);
throw new ConflictException("Email already exists");
throw new ValidationException("Required field missing: name");
```

Never throw `RuntimeException` or `Exception` directly.

---

## Branch Naming

Use descriptive branch names with a type prefix:

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<description>` | `feature/add-nats-retry-logic` |
| Bug fix | `fix/<description>` | `fix/tenant-context-not-cleared` |
| Refactor | `refactor/<description>` | `refactor/notification-repository` |
| Documentation | `docs/<description>` | `docs/update-kafka-readme` |
| Dependency updates | `deps/<description>` | `deps/upgrade-spring-boot-3.4` |

---

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | When to Use |
|------|------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `docs` | Documentation only changes |
| `chore` | Build system, dependency updates, CI changes |
| `perf` | Performance improvements |

### Scope

Use the module name (without `openframe-` prefix) as scope:

```text
feat(security-core): add PKCE utility for code challenge generation
fix(data-mongo-sync): resolve tenant context leak in batch operations
refactor(gateway-service-core): extract rate limit logic into service
test(data-nats): add integration test for notification broadcast
docs(api-service-core): update GraphQL data fetcher documentation
chore(deps): upgrade spring-boot to 3.3.2
```

### Examples

```text
feat(authorization-service-core): add Microsoft SSO provider strategy

Implements MicrosoftClientRegistrationStrategy to support Microsoft
Entra ID (Azure AD) authentication flows alongside existing Google SSO.

Closes: #discussion in #openframe-dev slack
```

```text
fix(stream-service-core): handle null tenant_id in debezium enrichment

When a Debezium event is missing the tenant header, the enrichment service
now falls back to domain-based tenant resolution instead of throwing NPE.
```

---

## Pull Request Process

### Before Opening a PR

1. **Build passes:** `mvn install -DskipTests`
2. **Tests pass:** `mvn test -pl <affected-module>`
3. **No secrets committed:** Review all changed files
4. **Follows code style:** Check Lombok, constructor injection, tenant scoping
5. **Covers edge cases:** Add unit tests for new logic

### PR Title

Use the same format as commit messages:

```text
feat(security-core): add PKCE utility for authorization flows
fix(data-mongo-sync): resolve tenant context leak
```

### PR Description Template

```markdown
## What does this PR do?

Brief description of the change.

## Why?

Motivation for the change.

## How was it tested?

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] No secrets in code or tests
- [ ] All new endpoints have authorization rules
- [ ] New DB queries are tenant-scoped
- [ ] Input validation on all new DTOs
- [ ] No breaking changes (or breaking changes are documented)
```

### Review Checklist (for Reviewers)

- [ ] Code follows established patterns (constructor injection, Lombok, multi-tenancy)
- [ ] New functionality is tested
- [ ] Security considerations are addressed (tenant scope, input validation, no secrets)
- [ ] Error handling uses the standard exception hierarchy
- [ ] No performance regressions (N+1 queries, missing indexes)

---

## Versioning

All modules are versioned together using `${revision}` in the parent POM. Version bumps are managed by the maintainers. Contributors do not need to update the version number in PRs.

The version follows [Semantic Versioning](https://semver.org/):
- **Major:** Breaking API changes
- **Minor:** New backward-compatible features
- **Patch:** Backward-compatible bug fixes

---

## Adding a New Module

When adding a new module to the library:

1. Create the module directory following the existing naming convention (`openframe-<name>/`)
2. Add a `pom.xml` that inherits from the parent
3. Add the module to the parent `pom.xml` `<modules>` section
4. Add the module to `<dependencyManagement>` in the parent with `${revision}`
5. Write unit tests before submitting
6. Update the README and architecture documentation

```xml
<!-- Parent pom.xml: modules section -->
<module>openframe-my-new-module</module>

<!-- Parent pom.xml: dependencyManagement -->
<dependency>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-my-new-module</artifactId>
    <version>${revision}</version>
</dependency>
```

---

## Getting Help

Stuck on a contribution? Reach out on the [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) in `#openframe-dev`.
