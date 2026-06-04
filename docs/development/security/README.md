# Security Best Practices

This guide covers security patterns, authentication flows, secrets management, and security testing practices for `openframe-oss-lib`.

---

## Overview

OpenFrame OSS Lib implements a defense-in-depth security model with multiple layers:

```mermaid
flowchart TD
    subgraph Layer1["Layer 1 - Network Edge"]
        CORS["CORS Policy"]
        RateLimit["Rate Limiting"]
        OriginSanitize["Origin Sanitizer"]
    end

    subgraph Layer2["Layer 2 - Authentication"]
        JWT["JWT Validation (multi-issuer)"]
        ApiKey["API Key Authentication"]
        PKCE["PKCE + OAuth2"]
    end

    subgraph Layer3["Layer 3 - Authorization"]
        RoleBased["Role-Based Access Control"]
        TenantScope["Tenant Scoping"]
    end

    subgraph Layer4["Layer 4 - Data"]
        Encryption["Field Encryption (AES)"]
        HashPasswords["BCrypt Password Hashing"]
        TenantFilter["Tenant-Scoped Queries"]
    end

    Layer1 --> Layer2
    Layer2 --> Layer3
    Layer3 --> Layer4
```

---

## Authentication Architecture

### JWT-Based Authentication

All API requests are authenticated via **RS256 JWT tokens** issued by the Authorization Service Core.

**JWT Claims structure:**

```json
{
  "sub": "user-id",
  "tenant_id": "my-tenant",
  "roles": ["ADMIN"],
  "iss": "https://auth.yourdomain.com/my-tenant",
  "exp": 1234567890
}
```

**Key security properties:**

| Property | Value |
|----------|-------|
| Algorithm | RS256 (RSA + SHA-256) |
| Key Type | Per-tenant RSA key pairs |
| Key Storage | Encrypted in MongoDB (`tenant_keys` collection) |
| JWKS Exposure | Per-tenant `.well-known/jwks.json` endpoint |
| Token Validation | Strict issuer + signature + expiry validation |

### Multi-Issuer JWT Validation

The gateway maintains a **Caffeine cache** of authentication managers keyed by issuer URL. This means:

- Each tenant has a distinct issuer URL
- Tokens from different tenants are validated against the correct signing keys
- Invalid issuer URLs are immediately rejected (not cached)

```mermaid
flowchart TD
    Token["JWT Token"] --> Extract["Extract iss claim"]
    Extract --> Allowed{"Is issuer allowed?"}
    Allowed -->|No| Reject["401 Unauthorized"]
    Allowed -->|Yes| Cache{"Cache hit?"}
    Cache -->|Yes| Validate["Validate Signature"]
    Cache -->|No| LoadKey["Load Public Key via JWKS"]
    LoadKey --> CacheKey["Cache Auth Manager"]
    CacheKey --> Validate
    Validate --> Success["Request proceeds"]
    Validate -->|Invalid| Reject
```

---

## API Key Authentication

The External API uses **API key authentication** instead of JWT for machine-to-machine access.

### API Key Format

API keys are stored in MongoDB with the following security controls:

- Keys are **hashed** before storage (BCrypt)
- Raw key value is only returned once at creation time
- Keys support per-minute, per-hour, and per-day rate limits
- API key ID is sent as a request header (`X-API-KEY-ID`) for tracing

### Rate Limiting

```text
Default rate limits per API key:
- Per minute:  60 requests
- Per hour:    1,000 requests  
- Per day:     10,000 requests
```

Rate limit state is stored in **Redis** for cross-instance consistency.

---

## OAuth2 / OIDC Security

### PKCE Enforcement

All OAuth2 authorization code flows **require PKCE** (Proof Key for Code Exchange):

```mermaid
sequenceDiagram
    participant Client
    participant BFF as "OAuth BFF Controller"
    participant AuthServer

    Client->>BFF: GET /oauth/login
    BFF->>BFF: Generate code_verifier + code_challenge (SHA-256)
    BFF->>BFF: Generate state (SecureRandom)
    BFF->>AuthServer: Redirect with code_challenge + state
    AuthServer->>Client: Login form
    Client->>AuthServer: Submit credentials
    AuthServer->>BFF: Authorization code + state
    BFF->>BFF: Validate state (from secure cookie)
    BFF->>AuthServer: Exchange code + code_verifier for tokens
    AuthServer->>BFF: Access + Refresh tokens
    BFF->>Client: Set HttpOnly cookies
```

**Security controls:**
- `code_verifier` is 256-bit random, Base64URL-encoded
- `code_challenge` = `BASE64URL(SHA256(code_verifier))`
- `state` is a signed JWT stored in a secure cookie to prevent CSRF

### Token Storage

Tokens are stored in **HttpOnly, Secure cookies** to prevent XSS access:

| Cookie | Content | Attributes |
|--------|---------|-----------|
| `access_token` | JWT access token | HttpOnly, Secure, SameSite=Strict |
| `refresh_token` | Opaque refresh token | HttpOnly, Secure, SameSite=Strict |

---

## Role-Based Access Control (RBAC)

### Roles

| Role | Description | Scope |
|------|-------------|-------|
| `OWNER` | Full tenant access; implicitly includes ADMIN | Tenant-level |
| `ADMIN` | Full administrative access to tenant resources | Tenant-level |
| `AGENT` | Machine/agent authentication only | Device-level |

### Path Authorization

The gateway enforces role requirements per path:

| Path Pattern | Required Role |
|-------------|--------------|
| `/api/**` | `ADMIN` |
| `/tools/agent/**` | `AGENT` |
| `/ws/tools/agent/**` | `AGENT` |
| `/ws/nats` | `AGENT` or `ADMIN` |
| `/content/**` | `ADMIN` |
| `/external-api/**` | Valid API Key |

---

## Secrets Management

### Environment Variables for Secrets

Never hardcode secrets. Use environment variables or a secrets manager:

```bash
# JWT RSA Keys (load from secrets manager in production)
export JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
export JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."

# OAuth client credentials
export OAUTH_CLIENT_DEFAULT_ID="your-client-id"
export OAUTH_CLIENT_DEFAULT_SECRET="your-client-secret"

# Database credentials
export SPRING_DATA_MONGODB_URI="mongodb+srv://user:pass@host/db"
```

### Key Rotation

Per-tenant RSA signing keys are stored encrypted in MongoDB. The `TenantKeyService` supports:

- Generating new RSA key pairs per tenant
- Encrypting private keys at rest using `EncryptionService`
- Rotating keys without disrupting active sessions (old keys remain in JWKS until expired)

---

## Input Validation and Sanitization

### Bean Validation

All DTOs use Jakarta Bean Validation (`@Valid`, `@NotNull`, `@Email`, etc.):

```java
// Example: validated DTO
public class CreateOrganizationRequest {
    @NotBlank
    private String name;

    @ValidEmail  // Custom validator in openframe-core
    private String email;
}
```

### Custom Validators

The `openframe-core` module provides reusable custom validators:

| Annotation | Description |
|-----------|-------------|
| `@ValidEmail` | Email format validation with normalization |
| `@TenantDomain` | Tenant subdomain format validation |

### GraphQL Input Validation

GraphQL mutations validate inputs before reaching the service layer. Validation errors are returned as structured `MutationError` objects (not HTTP errors).

---

## Data Encryption

### Field-Level Encryption

The `openframe-core-crypto` module provides `EncryptionService` for encrypting sensitive fields at rest:

```java
@Autowired
private EncryptionService encryptionService;

// Encrypt before saving
String encrypted = encryptionService.encrypt(sensitiveValue);

// Decrypt when reading
String plaintext = encryptionService.decrypt(encrypted);
```

This is used for:
- Tool credentials (API keys for Tactical RMM, Fleet MDM)
- Per-tenant RSA private keys
- Agent registration secrets

---

## Common Security Vulnerabilities and Mitigations

| Vulnerability | Mitigation |
|--------------|-----------|
| **JWT Forgery** | RS256 asymmetric keys; private key never leaves Authorization Server |
| **CSRF** | PKCE `state` parameter; SameSite cookie policy |
| **XSS token theft** | HttpOnly cookies; tokens never in JavaScript-accessible storage |
| **SQL/NoSQL Injection** | Spring Data MongoTemplate with typed queries; no raw string interpolation |
| **Authorization Bypass** | Gateway-level enforcement; tenant-scoped queries at data layer |
| **Replay Attacks** | Short-lived access tokens (configurable TTL); refresh token rotation |
| **Brute Force** | Rate limiting at Gateway (Redis-backed per API key) |
| **Insecure Direct Object Reference** | Tenant-scoped queries; all queries include `tenantId` filter |

---

## Security Testing Guidelines

### Testing Authentication

The `openframe-test-service-core` module provides authentication helpers for integration tests:

```java
// Obtain an auth token for tests
AuthFlow authFlow = new AuthFlowOSS(environmentConfig);
AuthParts auth = authFlow.login("user@example.com", password);

// Use token in test requests
RequestSpecHelper.withAuth(auth)
    .get("/api/devices")
    .then()
    .statusCode(200);
```

### Testing Authorization

Always test:
1. **Authenticated access** → returns expected data
2. **Unauthenticated access** → returns 401
3. **Wrong tenant access** → returns 403 or empty data
4. **Insufficient role** → returns 403

### Security Code Review Checklist

When reviewing security-relevant code, verify:

- [ ] All new DTOs have `@Valid` annotations on request-body parameters
- [ ] New MongoDB queries always filter by `tenantId`
- [ ] New API endpoints are covered by Gateway path authorization rules
- [ ] Sensitive fields use `EncryptionService` for at-rest protection
- [ ] No secrets or keys are logged (check log statements in new code)
- [ ] New OAuth flows use PKCE
- [ ] New external integrations use stored, encrypted credentials
