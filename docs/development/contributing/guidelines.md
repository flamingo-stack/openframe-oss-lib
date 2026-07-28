# Contributing Guidelines

Thank you for contributing to **OpenFrame OSS Lib**! This document outlines the standards, processes, and conventions to follow when making contributions.

---

## Community First

OpenFrame is built in the open. Before submitting a PR, discuss your idea in the **OpenMSP Slack community**:

https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA

For bugs, improvements, or feature ideas — start a conversation in Slack rather than directly opening a PR. This avoids duplicate work and ensures alignment with the platform roadmap.

> **Note:** We do not use GitHub Issues or GitHub Discussions. All community coordination happens on Slack.

---

## Code Style and Conventions

### Java

The project uses **Java 21** with Spring Boot 3.3 conventions.

| Convention | Standard |
|---|---|
| Indentation | 4 spaces (no tabs) |
| Line length | 120 characters max |
| Imports | No wildcard imports (`import com.example.*` is forbidden) |
| Annotations | Lombok — use `@Data`, `@Builder`, `@RequiredArgsConstructor`, `@Slf4j` |
| Logging | `@Slf4j` + `log.info()`, `log.debug()`, `log.error()` — never `System.out.println` |
| Null handling | Prefer `Optional<T>` for nullable return types in services |
| Exception handling | Extend `BaseException` hierarchy from `openframe-exception` |

### Lombok Usage

Lombok is a first-class citizen in this codebase. Prefer Lombok over manual boilerplate:

```java
// ✅ Preferred
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyDocument {
    private String id;
    private String name;
}

// ❌ Avoid — manual getters/setters/builders
public class MyDocument {
    private String id;
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
}
```

### Spring Dependency Injection

Use constructor injection (enabled by Lombok's `@RequiredArgsConstructor`):

```java
// ✅ Constructor injection (preferred)
@Service
@RequiredArgsConstructor
public class MyService {
    private final MyRepository repository;
    private final EncryptionService encryptionService;
}

// ❌ Field injection (avoid)
@Service
public class MyService {
    @Autowired
    private MyRepository repository;
}
```

### TypeScript / React (Frontend)

For `openframe-frontend-core`:

| Convention | Standard |
|---|---|
| Formatter | Prettier (auto-applied on save) |
| Linter | ESLint (auto-fixed on save) |
| Component style | Functional components with React Hooks |
| CSS | Tailwind CSS utility classes |
| Imports | Relative imports within the library |

### Rust (Agent Client)

For `clients/openframe-client`:

| Convention | Standard |
|---|---|
| Formatter | `cargo fmt` before commit |
| Linter | `cargo clippy -- -D warnings` (no warnings allowed) |
| Error handling | `anyhow` or domain-specific `Result<T, E>` — no `.unwrap()` in production code |
| Async | Tokio async runtime |

---

## Branch Naming

Use the following naming conventions for branches:

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<short-description>` | `feat/add-script-tagging` |
| Bug fix | `fix/<short-description>` | `fix/tenant-query-filter` |
| Refactor | `refactor/<short-description>` | `refactor/notification-service` |
| Documentation | `docs/<short-description>` | `docs/update-arch-overview` |
| Chore | `chore/<short-description>` | `chore/bump-spring-boot-version` |

Branch names should be lowercase with hyphens. No uppercase, no underscores.

---

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | Use When |
|---|---|
| `feat` | Adding a new feature |
| `fix` | Fixing a bug |
| `refactor` | Code change with no behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation updates only |
| `chore` | Build, tooling, or dependency updates |
| `perf` | Performance improvements |
| `style` | Code style / formatting changes |

### Scope

Use the module name or domain as scope:

```text
feat(gateway): add origin sanitizer filter
fix(api-service-core): correct cursor encoding for script schedules
test(data-mongo-sync): add integration test for notification read state
chore(deps): bump testcontainers to 1.21.4
```

### Good Commit Message Examples

```text
feat(authorization-service-core): add Microsoft SSO tenant registration flow

Implements SSO-based tenant registration for Microsoft OIDC providers.
Includes cookie-based state management and tenant creation on first login.

Closes #SLACK-123
```

```text
fix(stream-processing-core): prevent overwriting terminal execution states

CommandExecutionStatusUpdateHandler now checks for FAILED/SUCCESS before
updating to avoid race condition when duplicate Kafka messages arrive.
```

---

## Pull Request Process

### Before Opening a PR

- [ ] Discuss the change in Slack if it's non-trivial
- [ ] Rebase on the latest `main` branch
- [ ] All tests pass locally (`mvn test`)
- [ ] Integration tests pass if relevant (`mvn verify`)
- [ ] Java code is formatted (IntelliJ auto-format or `mvn spotless:apply` if configured)
- [ ] TypeScript/Rust code is formatted (`npm run format` / `cargo fmt`)
- [ ] No secrets or credentials in the diff
- [ ] New public APIs include Javadoc

### PR Description Template

```markdown
## Summary
Brief description of what this PR does and why.

## Changes
- Added/modified/removed X
- Added/modified/removed Y

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manually tested against [describe environment]

## Related
- Slack thread: [link if applicable]
```

### Review Checklist

Reviewers should verify:

- [ ] New MongoDB repositories extend `TenantAwareRepository` (tenant isolation)
- [ ] No raw `MongoTemplate` usage for tenant-scoped data
- [ ] No hardcoded credentials, URLs, or environment-specific values
- [ ] Sensitive fields are encrypted via `EncryptionService`
- [ ] Exception handling uses the `openframe-exception` hierarchy
- [ ] Tests cover the happy path and at least one error path
- [ ] New external API endpoints have corresponding OpenAPI annotations

---

## Module Contribution Guidelines

### Adding a New Library Module

1. Create the module directory at the repo root
2. Add a `pom.xml` that inherits from the parent:

```xml
<parent>
    <groupId>com.openframe.oss</groupId>
    <artifactId>openframe-oss-lib</artifactId>
    <version>${revision}</version>
</parent>
<artifactId>openframe-my-new-module</artifactId>
```

3. Add the module to the parent `pom.xml` `<modules>` section
4. Add the module to `<dependencyManagement>` in the parent `pom.xml`
5. Write a `README.md` in the module directory

### Updating Dependencies

All dependency versions are centrally managed in the parent `pom.xml` `<properties>` and `<dependencyManagement>` sections. When upgrading a dependency:

1. Update the version in the parent POM only
2. Do not specify versions in child module POMs
3. Run the full test suite after version bumps: `mvn verify`

---

## Versioning

The repository uses CI-friendly versioning via the `flatten-maven-plugin`:

- Development builds: `999-SNAPSHOT` (default `${revision}`)
- Release builds: Set `revision` via CI/CD (e.g., `mvn -Drevision=1.2.3 clean install`)

Do not manually change version numbers in source files. The CI pipeline manages release versioning.

---

## License

By contributing to OpenFrame OSS Lib, you agree that your contributions will be licensed under the same license as the project. See the repository root for the license file.

---

## Getting Help

For questions about contributing:

- **OpenMSP Slack**: https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA
- **Repository**: https://github.com/flamingo-stack/openframe-oss-lib
- **OpenFrame Platform**: https://openframe.ai
