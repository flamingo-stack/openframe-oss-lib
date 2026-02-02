# `openframe-data-redis`

Shared Redis integration for OpenFrame services.

## Tenant-aware key format (mandatory)

All OpenFrame keys must be namespaced by tenant:

`<keyPrefix>:{<tenantId>}:<relativeKey>`

Example (defaults):

- `openframe.redis.key-prefix = of`
- `openframe.redis.tenant-id = shared`

Resulting keys:

- Password reset token: `of:{shared}:pwdreset:<token>`
- Email verification token: `of:{shared}:emailverify:<token>`
- OAuth dev ticket: `of:{shared}:oauth:devticket:<ticketId>`
- Rate limit window: `of:{shared}:rate_limit:<keyId>:<window>:<timestamp>`

`tenant-id` is **required**. If it’s missing/blank, key building fails fast.

## Why `{tenantId}` (hash-tag)

The `{tenantId}` segment is a Redis Cluster hash-tag. It keeps per-tenant keys in the same hash slot, which helps
locality and avoids surprises with multi-key operations.

## Spring Cache (`@Cacheable`)

`openframe-data-redis` configures Spring Cache so cache keys are tenant-aware automatically:

`of:{tenantId}:<cacheName>::<cacheKey>`

## Configuration

Set these properties (typically via Config Server / env vars):

```yaml
openframe:
  redis:
    # REQUIRED
    tenant-id: ${TENANT_ID}
    # optional, default: "of"
    key-prefix: of
    # optional, default: true
    tenant-hash-tag: true
    keys:
      password-reset-prefix: pwdreset
      email-verify-prefix: emailverify
      login-assert-prefix: loginassert
      oauth-dev-ticket-prefix: "oauth:devticket"
      rate-limit-prefix: rate_limit
      api-key-stats-prefix: stats
      gateway-prefix: gateway
      ai-agent-prefix: ai-agent
```

