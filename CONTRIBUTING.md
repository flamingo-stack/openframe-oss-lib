<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shdrojejslhgnojzkzak.supabase.co/storage/v1/object/public/public/doc-orchestrator/logos/1771384787765-92lldo-logo-openframe-full-dark-bg.png">
    <source media="(prefers-color-scheme: light)" srcset="https://shdrojejslhgnojzkzak.supabase.co/storage/v1/object/public/public/doc-orchestrator/logos/1771384795200-4l8vh-logo-openframe-full-light-bg.png">
    <img alt="OpenFrame" src="https://shdrojejslhgnojzkzak.supabase.co/storage/v1/object/public/public/doc-orchestrator/logos/1771384795200-4l8vh-logo-openframe-full-light-bg.png" width="400">
  </picture>
</div>

# Contributing to openframe-oss-lib

Thank you for contributing to `openframe-oss-lib`! This document outlines how to get involved, our code conventions, branching strategy, commit standards, and the pull request process.

---

## Community First

> **All project discussion, support, and contributions are coordinated through the OpenMSP Slack community.**
> We do not use GitHub Issues or GitHub Discussions.
>
> 💬 **Join**: [https://www.openmsp.ai/](https://www.openmsp.ai/)
>
> 🔗 **Direct invite**: [https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA)

Before opening a pull request for a significant change, please discuss it in Slack to align on the approach with the maintainers.

---

## Getting Started

Before contributing, ensure your development environment is set up correctly. See the full guides:

- [Prerequisites](./docs/getting-started/prerequisites.md) — Required tools and versions
- [Local Development](./docs/development/setup/local-development.md) — Clone, build, and run locally
- [Environment Setup](./docs/development/setup/environment.md) — IDE and toolchain configuration

---

## Code Style and Conventions

### Java Conventions

| Convention | Rule |
|-----------|------|
| **Indentation** | 4 spaces (no tabs) |
| **Line length** | 120 characters maximum |
| **Imports** | No wildcard imports |
| **Naming** | Standard Java naming (camelCase for methods/fields, PascalCase for classes) |
| **Access modifiers** | Use the most restrictive access level possible |
| **Final fields** | Use `final` for fields that are not reassigned |
| **Null handling** | Use `Optional<T>` for nullable return values |

### Lombok Usage

Prefer the following Lombok annotations:

```java
// Immutable DTOs
@Value
public class AgentRegistrationResponse {
    String machineId;
    String clientSecret;
}

// Constructor injection (preferred pattern)
@Service
@RequiredArgsConstructor
public class DeviceService {
    private final MachineRepository machineRepository;
    private final TagService tagService;
}

// Complex object construction
@Builder
public class NotificationMessage {
    private String title;
    private String description;
    private NotificationSeverity severity;
}
```

### Spring Conventions

- **Constructor injection** is preferred over field injection
- Use `@RequiredArgsConstructor` with `final` fields for Spring components
- Avoid `@Autowired` on fields
- Keep controllers thin — delegate all business logic to service classes
- Controllers must return DTOs, not domain documents

---

## Branch Naming

| Type | Format | Example |
|------|--------|---------|
| Feature | `feature/short-description` | `feature/add-notification-webhooks` |
| Bug fix | `fix/short-description` | `fix/agent-registration-timeout` |
| Refactor | `refactor/short-description` | `refactor/simplify-tenant-resolution` |
| Documentation | `docs/short-description` | `docs/update-gateway-readme` |
| Chore | `chore/short-description` | `chore/upgrade-spring-boot-3.4` |

**Rules:**
- Use lowercase and hyphens — no spaces or underscores
- Keep names short but descriptive (3–6 words)
- Branch from `main` (or the current release branch) unless instructed otherwise

---

## Commit Message Format

This project uses the **Conventional Commits** specification:

```text
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Commit Types

| Type | When to use |
|------|------------|
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `refactor` | Code restructuring without behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation-only changes |
| `chore` | Build system, dependency updates, CI config |
| `perf` | Performance improvements |
| `style` | Formatting changes (no behavior change) |

### Scope

Use the module name (without `openframe-` prefix) as the scope:

```text
feat(api-service-core): add bulk device status update endpoint
fix(gateway-service-core): resolve rate limit header not set on 429 response
refactor(data-mongo-sync): simplify cursor pagination in notification repository
test(authorization-service-core): add SSO invitation acceptance integration test
chore: upgrade spring-boot to 3.3.1
```

---

## Pull Request Process

### Before Opening a PR

1. **Discuss in Slack** — Align with maintainers for significant changes
2. **Write tests** — New features require unit tests; bug fixes require regression tests
3. **Check tests pass** — Run `mvn test` locally before pushing
4. **Follow code style** — Format your code before committing

### PR Title

Use the same Conventional Commits format:

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
- [ ] Configuration properties are documented

---

## Adding a New Module

If your contribution requires a new module:

1. Follow the existing module structure conventions
2. Add the module to the root `pom.xml` `<modules>` section
3. Add it to `<dependencyManagement>` with `${revision}` version
4. Use `com.openframe.oss` as the `groupId` and follow the `openframe-*` artifact naming convention
5. Ensure the module has a meaningful `<description>` in its `pom.xml`
6. Add appropriate unit and integration tests before opening the PR

---

## Testing Guidelines

### Running Tests

```bash
# Run all unit tests (no Docker required)
mvn test

# Run integration tests (requires Docker)
mvn verify

# Run tests for a specific module
mvn test -pl openframe-api-service-core
```

### Test Naming Conventions

| Test Type | File Suffix | Example |
|-----------|------------|---------|
| Unit Test | `*Test.java` | `CommandDispatchServiceTest` |
| Integration Test | `*IT.java` | `NotificationServiceIT` |
| UI Test | `*UITest.java` | `DeviceRemoteTest` |

### Coverage Guidelines

| Test Type | Recommended Coverage |
|-----------|---------------------|
| Unit tests | ≥ 80% for service and utility classes |
| Integration tests | All repository methods with real infrastructure |
| E2E tests | All critical user flows (auth, device, ticket, org) |

Focus coverage on business logic in `*Service` classes, repository query methods, mapper/converter classes, and security-sensitive code.

---

## Security Guidelines for Contributors

When writing or reviewing security-relevant code:

- [ ] All new DTOs have `@Valid` annotations on request-body parameters
- [ ] New MongoDB queries always filter by `tenantId`
- [ ] New API endpoints are covered by Gateway path authorization rules
- [ ] Sensitive fields use `EncryptionService` for at-rest protection
- [ ] No secrets or keys are logged
- [ ] New OAuth flows use PKCE
- [ ] New external integrations use stored, encrypted credentials

For full security architecture details, see [Security Guide](./docs/development/security/README.md).

---

## Release Process

The project uses **flat Maven versioning** via the `${revision}` property in the parent POM. The current version is `6.0.10`.

Versions are published to GitHub Packages at:

```text
https://maven.pkg.github.com/flamingo-stack/openframe-oss-lib
```

Release coordination happens through the OpenMSP Slack `#engineering` channel.

---

## Questions?

> Join the **OpenMSP Slack** community for questions, discussions, and support.
>
> 💬 [https://www.openmsp.ai/](https://www.openmsp.ai/)

---

<div align="center">
  Built with 💛 by the <a href="https://www.flamingo.run/about"><b>Flamingo</b></a> team
</div>
