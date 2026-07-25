# First Steps

After completing the [Quick Start](quick-start.md), here are the first five things to explore in **openframe-oss-lib** to become productive quickly.

---

## 1. Understand the Module Structure

The repository is a Maven multi-module project. Each module is independently deployable and follows a consistent pattern:

```text
openframe-<module-name>/
├── src/
│   ├── main/java/com/openframe/...   # Production code
│   └── test/java/com/openframe/...   # Unit and integration tests
└── pom.xml                            # Module POM (inherits parent)
```

Start by reviewing the parent POM at the repository root to understand the full module list and shared dependency versions:

```bash
cat pom.xml
```

Key properties to note:

| Property | Value |
|----------|-------|
| `revision` | Current unified version (`5.79.3`) |
| `java.version` | `21` |
| `spring-boot-starter-parent` | `3.3.0` |
| `spring-cloud.version` | `2023.0.3` |

---

## 2. Explore the Core Domain Model

The best entry point for understanding the data model is `openframe-data-mongo-common`. This module defines all MongoDB documents:

```bash
ls openframe-data-mongo-common/src/main/java/com/openframe/data/document/
```

Key domain areas:

| Package | Domain |
|---------|--------|
| `device/` | `Device`, `Machine`, `DeviceHealth` |
| `organization/` | `Organization`, `ContactInformation` |
| `user/` | `User`, `AuthUser`, `Invitation` |
| `ticket/` | `Ticket`, `TicketNote`, `TicketAttachment` |
| `tool/` | `IntegratedTool`, `ToolConnection`, `ToolCredentials` |
| `notification/` | `Notification`, `NotificationContext`, `ReadStatus` |
| `tenant/` | `Tenant`, `TenantKey`, `SSOPerTenantConfig` |
| `oauth/` | `MongoRegisteredClient`, `OAuthToken` |

Read the domain model reference documentation for a full data-flow diagram and entity relationships:
[./reference/architecture/data-mongo-domain-model/data-mongo-domain-model.md](./reference/architecture/data-mongo-domain-model/data-mongo-domain-model.md)

---

## 3. Try the Security Modules

The security stack is a critical foundation for any OpenFrame service. Explore:

### `openframe-security-core`

Provides JWT signing and verification:

```java
// Inject the JwtService to sign or validate tokens
@Autowired
private JwtService jwtService;
```

Properties to configure (in `application.yml`):

```yaml
jwt:
  public-key: classpath:keys/public.pem
  private-key: classpath:keys/private.pem
  issuer: https://your-tenant.openframe.ai
  audience: openframe-api
```

### `openframe-security-oauth`

The OAuth BFF module provides ready-made endpoints for browser-based OAuth flows. To enable:

```yaml
openframe:
  gateway:
    oauth:
      enable: true
```

Exposed endpoints automatically:

- `GET /oauth/login`
- `GET /oauth/callback`
- `POST /oauth/refresh`
- `GET /oauth/logout`

---

## 4. Run Your First Integration Test

The `openframe-data-mongo-sync` module has a comprehensive integration test suite using Testcontainers. Run it to verify your local Docker setup:

```bash
# Start Docker first, then run integration tests
mvn verify -pl openframe-data-mongo-sync -Pfailsafe
```

Testcontainers will automatically:
1. Pull the MongoDB Docker image
2. Start a containerized MongoDB instance
3. Run all `*IT.java` tests against it
4. Tear down the container on completion

Integration test classes follow the `*IT.java` naming convention (configured in the parent `maven-surefire-plugin`).

---

## 5. Explore the Gateway Module

The gateway is the entry point for all service traffic. Review:

```bash
ls openframe-gateway-service-core/src/main/java/com/openframe/gateway/
```

Key files to read:

| File | Purpose |
|------|---------|
| `security/GatewaySecurityConfig.java` | Main reactive security filter chain |
| `security/filter/ApiKeyAuthenticationFilter.java` | API key authentication + rate limiting |
| `config/ws/WebSocketGatewayConfig.java` | WebSocket routing configuration |
| `upstream/DefaultToolUpstreamResolver.java` | Tool proxy URL resolution |

The gateway supports these route patterns:

```text
/api/**          → ADMIN role required
/tools/agent/**  → AGENT role required
/ws/tools/**     → WebSocket proxy to integrated tools
/external-api/** → API key authentication
```

---

## Where to Get Help

| Resource | Link |
|----------|------|
| OpenMSP Community (Slack) | [https://www.openmsp.ai/](https://www.openmsp.ai/) |
| OpenFrame Platform | [https://openframe.ai](https://openframe.ai) |
| Flamingo | [https://flamingo.run](https://flamingo.run) |
| Reference Architecture | [./reference/architecture/README.md](./reference/architecture/README.md) |

> **Note:** We use Slack for all community support and discussions. Please join the [OpenMSP Slack](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) instead of creating GitHub Issues.

---

## What to Explore Next

Once comfortable with the basics:

- Review the **Authorization Service** to understand multi-tenant JWT issuance
- Explore **Stream Service Core** for Kafka / Debezium event processing
- Look at **Management Service Core** for startup initializers and schedulers
- Check the **External API Service** for integration patterns

All reference documentation is available under:
[./reference/architecture/](./reference/architecture/)

[![OpenFrame v0.3.7 - Enhanced Developer Experience](https://img.youtube.com/vi/O8hbBO5Mym8/maxresdefault.jpg)](https://www.youtube.com/watch?v=O8hbBO5Mym8)
