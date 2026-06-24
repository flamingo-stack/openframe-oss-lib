<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shdrojejslhgnojzkzak.supabase.co/storage/v1/object/public/public/doc-orchestrator/logos/1771384787765-92lldo-logo-openframe-full-dark-bg.png">
    <source media="(prefers-color-scheme: light)" srcset="https://shdrojejslhgnojzkzak.supabase.co/storage/v1/object/public/public/doc-orchestrator/logos/1771384795200-4l8vh-logo-openframe-full-light-bg.png">
    <img alt="OpenFrame" src="https://shdrojejslhgnojzkzak.supabase.co/storage/v1/object/public/public/doc-orchestrator/logos/1771384795200-4l8vh-logo-openframe-full-light-bg.png" width="400">
  </picture>
</div>

# Contributing to openframe-oss-lib

Thank you for contributing to **openframe-oss-lib**! This guide covers everything you need to know: code style, branching strategy, commit conventions, pull request process, and security requirements.

---

## Community First

All contribution discussions happen on the [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA). We do **not** use GitHub Issues or GitHub Discussions.

Before starting a large contribution:

1. Join the [OpenMSP Slack](https://www.openmsp.ai/)
2. Describe what you're planning in the `#openframe-dev` channel
3. Get feedback from maintainers before investing significant effort

---

## Development Environment Setup

### Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Java (JDK) | 21 |
| Apache Maven | 3.9+ |
| Git | 2.x |
| Docker | 24.x |

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/flamingo-stack/openframe-oss-lib.git
cd openframe-oss-lib

# Configure GitHub Packages credentials
# Add to ~/.m2/settings.xml (see Prerequisites guide)

# Build all modules (skip tests for speed)
mvn install -DskipTests
```

### Recommended IDE

**IntelliJ IDEA** (Community or Ultimate) is the recommended IDE. After importing the project:

1. Set **Project SDK** to Java 21
2. Enable **Annotation Processors** for Lombok (`Settings → Compiler → Annotation Processors`)
3. Enable Maven delegate: `Settings → Build Tools → Maven → Runner → Delegate IDE build/run actions to Maven`
4. Increase heap: `Help → Change Memory Settings → Xmx: 4096 MB`

---

## Code Style and Conventions

### Rust (agent client)

The Rust OpenFrame agent lives under [`clients/`](clients/README.md) as the
`openframe-agent-lib` crate. Formatting and lint are **required** and enforced
both by committed git hooks and by CI:

```bash
make -C clients setup-hooks   # run once: pre-commit = cargo fmt --check, pre-push = cargo clippy
make -C clients lint          # the same gate, on demand
```

Clippy policy is "strict but sane" (`clippy::all` warns; `correctness` and
`suspicious` are denied), with any warning failing under `-D warnings`. See
[`clients/README.md`](clients/README.md) for the full workflow.

### Java Style

| Convention | Rule |
|-----------|------|
| Indentation | 4 spaces (no tabs) |
| Line length | Max 120 characters |
| Imports | No wildcard imports; organize by static → java → jakarta → spring → other |
| Braces | Opening brace on same line |
| Naming | `camelCase` methods/fields, `PascalCase` classes, `UPPER_SNAKE` constants |

### Lombok Usage

Use Lombok to reduce boilerplate:

```java
// Prefer these annotations
@Data          // getters, setters, equals, hashCode, toString
@Value         // immutable value objects
@Builder       // fluent builders
@RequiredArgsConstructor  // constructor injection
@Slf4j         // logging
```

### Spring Boot Conventions

Use constructor injection (via `@RequiredArgsConstructor`) over field injection:

```java
// Correct: Constructor injection
@Service
@RequiredArgsConstructor
public class MyService {
    private final MyRepository repository;
    private final AnotherService anotherService;
}
```

Prefer `@ConfigurationProperties` over `@Value` for configuration classes.

### Multi-Tenancy Requirements

Every service and repository method that accesses tenant-scoped data **must** include `tenantId` in queries:

```java
// Correct: Always scope to tenant
Optional<Organization> findByIdAndTenantId(String id, String tenantId);

// Wrong: Missing tenant scope — never do this for tenant-scoped data
Optional<Organization> findById(String id);
```

### Exception Handling

Use the standard exception hierarchy from `openframe-exception`:

```java
throw new NotFoundException("Organization not found: " + id);
throw new BadRequestException("Invalid email format");
throw new ForbiddenException("Access denied for tenant: " + tenantId);
throw new ConflictException("Email already exists");
throw new ValidationException("Required field missing: name");
```

Never throw raw `RuntimeException` or `Exception` directly.

---

## Branch Naming

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

Use the module name (without the `openframe-` prefix) as scope:

```text
feat(security-core): add PKCE utility for code challenge generation
fix(data-mongo-sync): resolve tenant context leak in batch operations
refactor(gateway-service-core): extract rate limit logic into service
test(data-nats): add integration test for notification broadcast
chore(deps): upgrade spring-boot to 3.3.2
```

### Example Commit

```text
feat(authorization-service-core): add Microsoft SSO provider strategy

Implements MicrosoftClientRegistrationStrategy to support Microsoft
Entra ID (Azure AD) authentication flows alongside existing Google SSO.

Closes: #discussion in #openframe-dev slack
```

---

## Pull Request Process

### Before Opening a PR

- [ ] Build passes: `mvn install -DskipTests`
- [ ] Tests pass: `mvn test -pl <affected-module>`
- [ ] No secrets committed — review all changed files
- [ ] Follows code style: Lombok, constructor injection, tenant scoping
- [ ] Edge cases covered: unit tests added for new logic

### PR Title Format

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

---

## Testing Guidelines

### Test Structure

```text
openframe-<module>/
└── src/
    └── test/java/com/openframe/...
        ├── FooTest.java     # Unit test (runs in mvn test)
        └── FooIT.java       # Integration test (runs in mvn verify)
```

### Running Tests

```bash
# Unit tests for a specific module
mvn test -pl openframe-core

# Integration tests (requires Docker)
mvn verify -pl openframe-data-mongo-sync

# Skip all tests during build
mvn install -DskipTests
```

### Unit Test Template

```java
@ExtendWith(MockitoExtension.class)
class MyServiceTest {

    @Mock
    private MyRepository repository;

    @InjectMocks
    private MyService service;

    @Test
    void shouldReturnExpectedResult() {
        // Given
        when(repository.findById("id-1")).thenReturn(Optional.of(new MyEntity("id-1")));

        // When
        var result = service.getById("id-1");

        // Then
        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo("id-1");
    }
}
```

### Test Conventions

- Use **Given / When / Then** structure in test methods
- Test method names should describe behavior: `shouldReturnNotFoundWhenEntityDoesNotExist`
- Always clean up test data in `@AfterEach` for integration tests
- Integration tests use Testcontainers — Docker must be running

---

## Security Requirements

Before opening a PR, verify:

- [ ] No secrets, tokens, or keys in code or test fixtures
- [ ] All new endpoints have explicit authorization rules
- [ ] New database queries include `tenantId` scope
- [ ] Input validation annotations on all request DTOs
- [ ] Sensitive fields are encrypted at rest using `EncryptionService`
- [ ] No raw SQL/NoSQL string interpolation

**For security vulnerabilities**, do **not** open a public GitHub issue. Contact the team via the [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) in a direct message to the maintainers, or visit [flamingo.run](https://flamingo.run) for the security contact.

---

## Adding a New Module

When adding a new module to the library:

1. Create the module directory following the naming convention: `openframe-<name>/`
2. Add a `pom.xml` that inherits from the parent POM
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

## Versioning

All modules are versioned together using `${revision}` in the parent POM. Version bumps are managed by the maintainers. Contributors do **not** need to update version numbers in PRs.

Versioning follows [Semantic Versioning](https://semver.org/):

- **Major:** Breaking API changes
- **Minor:** New backward-compatible features
- **Patch:** Backward-compatible bug fixes

---

## Getting Help

Stuck? Reach out on the [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) in `#openframe-dev`.

- 🌐 **OpenFrame Platform:** [https://openframe.ai](https://openframe.ai)
- 💬 **OpenMSP Community:** [https://www.openmsp.ai/](https://www.openmsp.ai/)
- 🦩 **Flamingo:** [https://flamingo.run](https://flamingo.run)

---

<div align="center">
  Built with 💛 by the <a href="https://www.flamingo.run/about"><b>Flamingo</b></a> team
</div>
