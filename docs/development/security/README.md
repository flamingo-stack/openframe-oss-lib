# Security Best Practices

This guide covers security architecture, authentication and authorization patterns, secrets management, and secure development guidelines for `openframe-oss-lib`.

[![OpenFrame v0.3.0 - Remote File Manager & Unified Authentication Architecture](https://img.youtube.com/vi/mibUHvcVIHs/maxresdefault.jpg)](https://www.youtube.com/watch?v=mibUHvcVIHs)

---

## Authentication and Authorization Architecture

### Overview

OpenFrame implements a **multi-layered security model** across three service tiers:

```mermaid
flowchart TD
    Client["Client (Browser / Agent)"]
    Gateway["Gateway Service Core\n(JWT Validation + Role Enforcement)"]
    Auth["Authorization Service Core\n(OAuth2 / OIDC Token Issuance)"]
    API["API Service Core\n(OAuth2 Resource Server)"]
    ExternalAPI["External API\n(API Key + Rate Limiting)"]

    Client -->|"JWT"| Gateway
    Client -->|"API Key"| ExternalAPI
    Gateway -->|"Validated Request"| API
    Gateway --> Auth
    ExternalAPI -->|"Rate-limited Request"| API
    Auth -->|"Tenant-scoped JWT"| Client
```

### Layer 1: Authorization Service (Token Issuance)

The `openframe-authorization-service-core` module handles:
- **OAuth2/OIDC Authorization Server** (Spring Authorization Server 1.3.1)
- **Per-tenant RSA key pair generation** for JWT signing
- **SSO integration** (Google, Microsoft) via dynamic client registration
- **Password reset** and invitation flows
- **Tenant isolation** via `TenantContextFilter` (ThreadLocal)

**Custom JWT Claims:**
```text
tenant_id  – Tenant identifier
userId     – Platform user ID
roles      – User roles (OWNER implies ADMIN)
```

### Layer 2: Gateway (Token Validation)

The `openframe-gateway-service-core` module:
- Validates JWTs using **per-tenant RSA public keys** (Caffeine cached)
- Enforces **role-based access** (`ROLE_ADMIN`, `ROLE_AGENT`, `SCOPE_*`)
- Supports **multi-source token extraction**: cookie → header → query param
- Applies **CORS policies**
- Enforces **rate limits** on external API access

### Layer 3: API Service (Resource Protection)

The `openframe-api-service-core` module:
- Acts as an **OAuth2 Resource Server**
- Injects `AuthPrincipal` via `@AuthenticationPrincipal`
- Caches JWT decoders by issuer (Caffeine)
- Does **not** re-validate tokens — relies on Gateway enforcement

---

## API Key Security

External API access uses API keys with rate limiting:

```mermaid
flowchart TD
    Req["External Request to /external-api/**"]
    Check{"X-API-Key header present?"}
    Validate["Validate API Key in DB"]
    Rate{"Rate limit check"}
    Forward["Forward to API service"]

    Req --> Check
    Check -->|"No"| Reject401["401 Unauthorized"]
    Check -->|"Yes"| Validate
    Validate -->|"Invalid"| Reject401
    Validate -->|"Valid"| Rate
    Rate -->|"Exceeded"| Reject429["429 Too Many Requests"]
    Rate -->|"OK"| Forward
```

**Rate limit headers returned:**
- `X-RateLimit-Limit-Minute`
- `X-RateLimit-Remaining-Minute`
- `X-RateLimit-Limit-Hour`
- `X-RateLimit-Remaining-Hour`

**Best Practices for API Keys:**
- Rotate API keys regularly using the `ApiKeyController`
- Store API keys encrypted — the `openframe-core-crypto` module provides `EncryptionService` for AES encryption
- Never log API key values — only log key IDs
- Use `APIKeyType` to scope keys appropriately

---

## Secrets Management

### Environment Variables vs. Configuration

Never hardcode secrets in source code or configuration files. Always use environment variables:

```bash
# ✅ CORRECT: Use environment variables
export SPRING_DATA_MONGODB_URI=mongodb://user:secret@host/db

# ❌ WRONG: Hardcoded in application.yml
# spring.data.mongodb.uri: mongodb://user:hardcoded@host/db
```

### Encryption at Rest

The `openframe-core-crypto` module provides `EncryptionService` for encrypting sensitive data before storing in MongoDB:

```java
// Use EncryptionService to encrypt sensitive values before storage
// Example pattern used for tool credentials and RSA private keys
@Autowired
private EncryptionService encryptionService;

String encrypted = encryptionService.encrypt(sensitiveValue);
String decrypted = encryptionService.decrypt(encrypted);
```

**Fields encrypted in MongoDB:**
- RSA private keys in `TenantKey` documents
- Tool credentials in `ToolCredentials`
- OAuth client secrets

### Key Management

Per-tenant RSA keys are managed by `TenantKeyService`:
- Private keys are **encrypted before storage** using `EncryptionService`
- Public keys are served via the JWKS endpoint for JWT validation
- Keys can be independently rotated per tenant without affecting other tenants

---

## Input Validation and Sanitization

### Jakarta Validation

All API inputs use Jakarta Bean Validation constraints:

```java
// Example from RunCommandInput
@NotNull
private String machineId;

@NotNull
private String command;

@Positive
private Integer timeoutSeconds;
```

### Tenant Domain Validation

The `openframe-core` module provides custom validators:

```java
// @TenantDomain validates slug format for tenant identifiers
// @ValidEmail validates email addresses consistently
```

### GraphQL Input Validation

GraphQL mutations validate inputs using the same Jakarta constraints through Spring's validation integration. Invalid inputs return structured `MutationError` responses rather than exceptions.

---

## Multi-Tenant Isolation

**Critical principle:** All data access must be scoped to the current tenant.

```java
// TenantScoped documents always include tenantId
@Document(collection = "devices")
public class Machine implements TenantScoped {
    private String tenantId;
    // ...
}

// Repositories automatically filter by tenantId
// DefaultTenantIdProvider reads from TENANT_ID env var
// or falls back to "oss" for OSS single-tenant mode
```

**Security checklist for new repositories:**
- ✅ Document implements `TenantScoped`
- ✅ Repository queries include `tenantId` filter
- ✅ Custom repository implementations use `TenantIdProvider`
- ✅ Compound index includes `{ tenantId: 1, ... }`

---

## SSO Security

SSO flows (Google, Microsoft) use secure cookie-based state passing:

- `SsoCookieCodec` encrypts SSO state cookies
- `SsoAuthorizationRequestResolver` validates OIDC state parameters
- Dynamic client registration uses `DynamicClientRegistrationRepository` to prevent cross-tenant SSO contamination

**SSO Security Checklist:**
- ✅ Validate `state` parameter on all OAuth2 callbacks
- ✅ Use HTTP-only, Secure cookies for session state
- ✅ Scope SSO client registrations to specific tenants
- ✅ Never expose client secrets in frontend code

---

## Common Vulnerability Mitigations

| Vulnerability | Mitigation in OpenFrame |
|--------------|------------------------|
| **JWT Forgery** | Per-tenant RSA signing; issuer validated; strict decoder caching |
| **Cross-Tenant Data Leakage** | `tenantId` filter on all queries; `TenantContextFilter` on all requests |
| **API Key Brute Force** | Rate limiting per minute/hour/day at gateway level |
| **CSRF** | Stateless JWT-based auth; `OriginSanitizerFilter` in gateway |
| **Injection** | MongoDB query uses Spring Data criteria, not raw queries; strict input validation |
| **Secret Exposure** | Encryption at rest for private keys and credentials; env var management |
| **Unauthorized Tool Access** | Agent auth (`ROLE_AGENT`) separate from admin auth (`ROLE_ADMIN`) |

---

## Security Testing Guidelines

### Unit Testing Security Logic

```java
// Use TestAuthenticationManager for mocking auth in tests
// Located in: openframe-client-core/src/test/...
@Autowired
private TestAuthenticationManager testAuthenticationManager;
```

### Integration Testing Auth Flows

The `openframe-test-service-core` module provides full auth flow helpers:

```java
// AuthFlow, AuthFlowOSS, AuthFlowSAAS provide test auth flows
// Use AuthHelper for test authentication setup
AuthParts auth = authFlow.loginAsAdmin();
```

### Security Code Review Checklist

Before merging any security-related code:

- [ ] No secrets or credentials in source code
- [ ] All API inputs validated with Jakarta constraints
- [ ] New endpoints have appropriate role restrictions
- [ ] New MongoDB documents implement `TenantScoped`
- [ ] Sensitive fields encrypted before storage
- [ ] New API keys scoped to minimum required permissions
- [ ] SSO state parameters validated in callbacks
- [ ] Rate limiting applied to public-facing endpoints

---

## Environment Variables and Secrets Management

> **Never commit secrets to version control.** Use environment variables, secret management systems (Vault, AWS Secrets Manager, Kubernetes Secrets), or `.env` files that are excluded from Git.

```bash
# Add to .gitignore
.env
.env.local
*.secrets

# Use descriptive names for secret environment variables
JWT_SIGNING_KEY_SECRET=...
MONGODB_PASSWORD=...
REDIS_AUTH_PASSWORD=...
```

For questions or to report security issues, contact the team via [OpenMSP Slack](https://www.openmsp.ai/).
