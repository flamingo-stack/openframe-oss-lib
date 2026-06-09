# Contributing Guidelines

Thank you for contributing to `openframe-oss-lib`! This document outlines the code style, branching strategy, commit conventions, and PR review process.

---

## Community First

> **All project discussion, support, and contributions are coordinated through the OpenMSP Slack community.**
> We do not use GitHub Issues or GitHub Discussions.
>
> 💬 Join: [https://www.openmsp.ai/](https://www.openmsp.ai/)
> 
> 🔗 Direct invite: [https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)

Before opening a pull request for a significant change, discuss it in Slack to align on the approach.

---

## Code Style and Conventions

### Java Conventions

The project follows standard Spring Boot and Java conventions:

| Convention | Rule |
|-----------|------|
| **Indentation** | 4 spaces (no tabs) |
| **Line length** | 120 characters maximum |
| **Imports** | No wildcard imports (`import com.example.*`) |
| **Naming** | Standard Java naming (camelCase for methods/fields, PascalCase for classes) |
| **Access modifiers** | Use the most restrictive access level possible |
| **Final** | Use `final` for fields that are not reassigned |
| **Null handling** | Use `Optional<T>` for nullable return values; avoid `@Nullable` in service layers |

### Lombok Usage

This project uses Lombok to reduce boilerplate. Prefer:

```java
// ✅ Use @Value for immutable DTOs
@Value
public class AgentRegistrationResponse {
    String machineId;
    String clientSecret;
}

// ✅ Use @Data for mutable domain classes (sparingly)
@Data
@Document(collection = "devices")
public class Device implements TenantScoped {
    @Id
    private String id;
    private String tenantId;
}

// ✅ Use @Builder for complex object construction
@Builder
public class NotificationMessage {
    private String title;
    private String description;
    private NotificationSeverity severity;
}

// ✅ Use @RequiredArgsConstructor for constructor injection
@Service
@RequiredArgsConstructor
public class DeviceService {
    private final MachineRepository machineRepository;
    private final TagService tagService;
}
```

### Spring Conventions

- **Constructor injection** is preferred over field injection
- **`@RequiredArgsConstructor` + `final` fields** is the recommended pattern for Spring components
- Avoid `@Autowired` on fields
- Keep controllers thin: delegate all business logic to service classes
- Controllers should return DTOs, not domain documents

---

## Branch Naming

Use the following conventions for branch names:

| Type | Format | Example |
|------|--------|---------|
| Feature | `feature/short-description` | `feature/add-notification-webhooks` |
| Bug fix | `fix/short-description` | `fix/agent-registration-timeout` |
| Refactor | `refactor/short-description` | `refactor/simplify-tenant-resolution` |
| Documentation | `docs/short-description` | `docs/update-gateway-readme` |
| Chore | `chore/short-description` | `chore/upgrade-spring-boot-3.4` |

**Rules:**
- Use lowercase and hyphens, no spaces or underscores
- Keep names short but descriptive (3-6 words)
- Branch from `main` (or the current release branch) unless told otherwise

---

## Commit Message Format

Use the **Conventional Commits** specification:

```text
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | When to use |
|------|------------|
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `refactor` | Code restructuring without behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation only changes |
| `chore` | Build system, dependency updates, CI config |
| `perf` | Performance improvements |
| `style` | Formatting, missing semicolons (no behavior change) |

### Scope Examples

Use the module name (without `openframe-` prefix) as the scope:

```text
feat(api-service-core): add bulk device status update endpoint
fix(gateway-service-core): resolve rate limit header not being set on 429 response
refactor(data-mongo-sync): simplify cursor pagination in notification repository
test(authorization-service-core): add SSO invitation acceptance integration test
chore: upgrade spring-boot to 3.3.1
```

### Commit Message Examples

```text
feat(client-core): add virtual thread executor for tool installation tasks

Tool installation tasks can be I/O bound. Using virtual threads
allows higher concurrency without increased memory overhead.

Closes #123 (if you are using a ticket or task reference)
```

```text
fix(data-nats): retry NATS publish on transient connection failure

The publisher now retries up to 3 times with exponential backoff
when encountering a NatsException due to temporary disconnection.
```

---

## Pull Request Process

### Before Opening a PR

1. **Discuss in Slack** — For significant changes, align with maintainers first
2. **Write tests** — New features require unit tests; bug fixes require a regression test
3. **Check existing tests pass** — Run `mvn test` locally before pushing
4. **Follow code style** — Run your IDE formatter before committing

### PR Title

Use the same format as commit messages:

```text
feat(api-service-core): add GraphQL subscription for device status changes
```

### PR Description Template

```markdown
## Summary
Brief description of what this PR does.

## Changes
- List key changes made
- Include any migration steps if needed

## Testing
- Describe how you tested the changes
- List new tests added

## Related
- Link to Slack thread or task (if applicable)
```

### Review Process

1. At least **one maintainer approval** is required to merge
2. All CI checks (build + tests) must pass
3. Resolve all review comments before requesting re-review
4. Squash commits if the history is noisy (maintainer may do this at merge)

---

## Review Checklist

Use this checklist when reviewing or self-reviewing a PR:

### Correctness
- [ ] The change does what the PR description says
- [ ] Edge cases are handled (null inputs, empty collections, concurrent access)
- [ ] Error handling is appropriate (no swallowed exceptions)

### Security
- [ ] New MongoDB queries always filter by `tenantId`
- [ ] New API endpoints are covered by Gateway authorization rules
- [ ] Sensitive data uses `EncryptionService` for at-rest protection
- [ ] No secrets or credentials are hardcoded or logged

### Testing
- [ ] Unit tests cover the happy path and key error scenarios
- [ ] Integration tests are added for new repository methods
- [ ] Existing tests still pass

### Code Quality
- [ ] No unnecessary complexity added
- [ ] Follows the processor/extension pattern for lifecycle hooks
- [ ] Lombok annotations are used appropriately
- [ ] Constructor injection is used (not field injection)
- [ ] DTOs are used in controllers (not domain documents)

### Documentation
- [ ] Public interfaces and complex methods have Javadoc
- [ ] Configuration properties are documented (in-class or via `@ConfigurationProperties` description)

---

## Adding a New Module

If your contribution requires a new module:

1. Follow the existing module structure conventions
2. Add the module to the root `pom.xml` `<modules>` section
3. Add it to `<dependencyManagement>` with `${revision}` version
4. Use the `com.openframe.oss` groupId and follow the `openframe-*` artifact naming convention
5. Ensure the module has a meaningful `<description>` in its `pom.xml`
6. Add appropriate unit and integration tests before the PR

---

## Release Process

The project uses **Flat Maven versioning** via the `${revision}` property in the parent POM. The current version is `6.0.10`.

Versions are published to GitHub Packages at:
```text
https://maven.pkg.github.com/flamingo-stack/openframe-oss-lib
```

Release coordination happens through the OpenMSP Slack `#engineering` channel.
