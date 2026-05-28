# Security Best Practices

This guide covers the security patterns, conventions, and requirements for developing with and contributing to **openframe-oss-lib**.

---

## Authentication and Authorization Patterns

### JWT-Based Authentication

Every service in OpenFrame uses JWT bearer tokens for authentication. The library provides:

- **`openframe-security-core`** — JWT encoder/decoder beans, RSA key loading
- **`openframe-authorization-service-core`** — Multi-tenant OAuth2 Authorization Server
- **`openframe-gateway-service-core`** — Multi-issuer JWT validation at the edge

**Key principle:** JWTs are issued per-tenant with tenant-scoped RSA key pairs. Never use a shared signing key across tenants.

#### JWT Claims Structure

Every access token must contain:

| Claim | Description |
|-------|-------------|
| `tenant_id` | Tenant identifier for multi-tenancy |
| `userId` | Authenticated user's ID |
| `roles` | User roles (`ADMIN`, `OWNER`, `AGENT`) |
| `iss` | Issuer URL (tenant-specific) |
| `exp` | Expiration timestamp |

```java
// Correct: Extract tenant from JWT principal
@GetMapping("/me")
public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
    String tenantId = jwt.getClaimAsString("tenant_id");
    String userId = jwt.getClaimAsString("userId");
    // ...
}
```

### Multi-Tenant Key Isolation

Each tenant has its own RSA key pair managed by `TenantKeyService`:

```mermaid
flowchart LR
    Token["JWT Signing Request"] --> CTX["TenantContext.getTenantId()"]
    CTX --> KS["TenantKeyService.getOrCreateActiveKey()"]
    KS --> DB["MongoDB: TenantKey collection"]
    KS --> RSA["RSA Key Pair"]
    RSA --> JWT["Signed JWT"]
```

> **Never** share RSA key material between tenants or inject keys via environment variables in production. Always use the `TenantKeyService` for key lifecycle management.

### Role-Based Access Control

Gateway-level role enforcement is configured in `GatewaySecurityConfig`:

| Path Pattern | Required Role |
|-------------|--------------|
| `/api/**` | `ADMIN` |
| `/tools/agent/**` | `AGENT` |
| `/ws/tools/agent/**` | `AGENT` |
| `/ws/nats` | `ADMIN` or `AGENT` |
| `/external-api/**` | API key (no JWT required) |

When adding new routes, always explicitly define authorization rules. Never rely on implicit `permitAll()` for sensitive endpoints.

---

## OAuth2 Best Practices

### PKCE (Proof Key for Code Exchange)

All browser-initiated authorization flows **must** use PKCE. The `PKCEUtils` class provides:

```java
// Always use PKCE for browser flows
String codeVerifier = PKCEUtils.generateCodeVerifier();
String codeChallenge = PKCEUtils.generateCodeChallenge(codeVerifier);
String state = PKCEUtils.generateState();
```

Never implement custom PKCE logic — use the provided utility class.

### Token Storage

Tokens are stored as **HTTP-only cookies** by the OAuth BFF controller. This pattern prevents XSS-based token theft:

```text
Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict
Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict
```

> **Never** expose tokens in JavaScript-accessible storage (localStorage, sessionStorage) or URL parameters.

### API Keys

External API consumers authenticate via `X-API-Key` header. API keys follow a two-part format:

```text
X-API-Key: <keyId>.<secretKey>
```

Key security requirements:

- Store only the **hashed** secret in MongoDB (`ApiKey.secretHash`)
- Never log raw API key values
- Apply rate limiting via `RateLimitService` for all API key–authenticated routes
- Rotate API keys on suspected compromise

---

## Data Encryption and Secure Storage

### Encryption Service

The `openframe-core-crypto` module provides symmetric encryption for sensitive fields stored in MongoDB:

```java
@Autowired
private EncryptionService encryptionService;

// Encrypt before storing
String encrypted = encryptionService.encrypt(plainText);

// Decrypt on read
String plain = encryptionService.decrypt(encrypted);
```

Fields that should always be encrypted in MongoDB:

- Tool credentials (`ToolCredentials`)
- API key secrets (`ApiKey.secretHash` — hashed, not encrypted)
- SSO provider client secrets (`SSOConfig`)

### Password Hashing

Passwords are hashed using BCrypt via the `PasswordEncoder` bean provided by `ManagementConfiguration`:

```java
// Correct: Always hash passwords before storing
String hashed = passwordEncoder.encode(rawPassword);

// Correct: Verify passwords using the encoder
boolean matches = passwordEncoder.matches(rawPassword, hashed);
```

Never store raw passwords in any form — not in logs, databases, or environment variables.

---

## Input Validation and Sanitization

### Bean Validation

All request DTOs must use Jakarta Bean Validation annotations:

```java
@NotNull
@ValidEmail          // Custom OpenFrame validator
private String email;

@NotBlank
@TenantDomain        // Custom OpenFrame validator
private String tenantDomain;
```

Custom validators in `openframe-core`:

| Annotation | Validates |
|-----------|----------|
| `@ValidEmail` | Email format and domain |
| `@TenantDomain` | Tenant domain slug format |

### SQL / NoSQL Injection Prevention

MongoDB queries are always executed via Spring Data repositories or `MongoTemplate` with typed objects — never with raw string interpolation:

```java
// Correct: Use typed Spring Data query method
List<User> users = userRepository.findByTenantIdAndEmail(tenantId, email);

// Wrong: Never build raw query strings
// mongoTemplate.find(Query.query(Criteria.where("email").is("' OR '1'='1")), User.class);
```

---

## Common Security Vulnerabilities and Mitigations

| Vulnerability | Risk | Mitigation in openframe-oss-lib |
|-------------|------|-------------------------------|
| Cross-Tenant Data Access | CRITICAL | TenantContext + tenant-scoped repositories; always include `tenantId` in queries |
| JWT Token Forgery | HIGH | Per-tenant RSA keys; multi-issuer validation; short expiry |
| CSRF | MEDIUM | OAuth2 state parameter + PKCE; HTTP-only cookies with SameSite |
| API Key Exposure | HIGH | Keys hashed at rest; rate limiting; `X-API-Key` header only |
| XSS Token Theft | HIGH | HTTP-only cookies; CSP headers enforced at gateway |
| Mass Assignment | MEDIUM | Explicit DTO mapping; never expose domain documents directly |
| Insecure Direct Object Reference | HIGH | Always scope queries with `tenantId` + authorization checks |

---

## Secrets Management

### Local Development

For local development, use `application-local.yml` (never committed) to override sensitive properties:

```yaml
# application-local.yml (gitignored)
jwt:
  private-key: classpath:keys/local-private.pem
  public-key: classpath:keys/local-public.pem
spring:
  data:
    mongodb:
      uri: mongodb://localhost:27017/openframe-local
```

### Environment Variable Conventions

In production deployments, secrets must be injected as environment variables, never hardcoded:

```bash
# JWT keys
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."

# MongoDB
SPRING_DATA_MONGODB_URI="mongodb+srv://user:pass@cluster..."

# Redis
SPRING_DATA_REDIS_HOST="redis.internal"
```

> Use your platform's secret manager (AWS Secrets Manager, HashiCorp Vault, Kubernetes Secrets) to inject these values. Never commit secrets to version control.

### CI/CD Secret Handling

GitHub Actions secrets are referenced via:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Never echo, log, or print secrets in CI steps.

---

## Security Testing and Code Review Guidelines

### Pre-Commit Checklist

Before opening a Pull Request, verify:

- [ ] No secrets, tokens, or keys in code or test fixtures
- [ ] All new endpoints have explicit authorization rules
- [ ] New database queries include `tenantId` scope
- [ ] Input validation annotations on all request DTOs
- [ ] Sensitive fields are encrypted at rest
- [ ] No raw SQL/NoSQL string interpolation

### Integration Test Security

Integration tests should:

- Use randomly generated test data (not hardcoded UUIDs matching production patterns)
- Clean up test data after each test
- Never use production URLs or credentials

---

## Origin Sanitization

The `OriginSanitizerFilter` in the gateway sanitizes the `Origin` header to prevent header injection attacks. Never bypass this filter for external-facing routes.

```mermaid
flowchart LR
    Request["Incoming Request"] --> OSF["OriginSanitizerFilter"]
    OSF --> AHF["AddAuthorizationHeaderFilter"]
    AHF --> JWT["JWT Validation"]
    JWT --> Route["Route Handler"]
```

---

## Reporting Security Issues

For security vulnerabilities, do **not** open a public GitHub issue. Contact the team via the [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) in a direct message to the maintainers, or email the security contact listed on [flamingo.run](https://flamingo.run).
