# Api Service Core Rest Controllers

The **Api Service Core Rest Controllers** module exposes the primary internal REST endpoints of the OpenFrame API Service Core. It acts as the HTTP boundary layer between clients (UI, agents, internal services) and the underlying application services, command/query services, and domain logic.

This module is responsible for:

- Exposing secure REST endpoints for tenant-scoped operations
- Delegating business logic to dedicated service layers
- Translating HTTP semantics into domain/service calls
- Enforcing authentication context via `AuthPrincipal`
- Returning DTO-based responses for consistency and API stability

It complements the GraphQL data fetchers and external API controllers by providing internal and operational REST endpoints.

---

## Architectural Role in the Platform

Within the overall OpenFrame architecture, the Api Service Core Rest Controllers module sits at the edge of the API Service Core and depends on:

- Application services (command/query services)
- Domain services and processors
- Security context (`AuthPrincipal`)
- Mongo-backed persistence modules
- Tenant-aware authorization infrastructure

```mermaid
flowchart TD
    Client["Client / UI / Agent"] --> Gateway["Gateway Service"]
    Gateway --> ApiCore["API Service Core"]

    subgraph rest_layer["REST Controller Layer"]
        Controllers["Api Service Core Rest Controllers"]
    end

    subgraph service_layer["Service Layer"]
        CommandServices["Command Services"]
        QueryServices["Query Services"]
        DomainProcessors["Domain Processors"]
    end

    subgraph data_layer["Data Layer"]
        Mongo["Mongo Repositories"]
        Redis["Redis Cache"]
        Kafka["Kafka / Events"]
    end

    ApiCore --> Controllers
    Controllers --> CommandServices
    Controllers --> QueryServices
    Controllers --> DomainProcessors

    CommandServices --> Mongo
    QueryServices --> Mongo
    DomainProcessors --> Kafka
    DomainProcessors --> Redis
```

The controllers themselves contain minimal business logic and primarily orchestrate calls to services.

---

## Controller Overview

The module contains the following REST controllers:

- AgentRegistrationSecretController
- ApiKeyController
- DeviceController
- ForceAgentController
- HealthController
- InvitationController
- MeController
- OpenFrameClientConfigurationController
- OrganizationController
- ReleaseVersionController
- SSOConfigController
- UserController

Each controller is scoped to a specific functional domain.

---

# Endpoint Domains

## 1. Agent Registration Secret

**Base Path:** `/agent/registration-secret`

Controller: `AgentRegistrationSecretController`

Responsibilities:

- Retrieve active registration secret
- List all historical secrets
- Generate new registration secret

```mermaid
sequenceDiagram
    participant Admin
    participant Controller as AgentRegistrationSecretController
    participant Service as AgentRegistrationSecretService

    Admin->>Controller: POST /agent/registration-secret/generate
    Controller->>Service: generateNewSecret()
    Service-->>Controller: AgentRegistrationSecretResponse
    Controller-->>Admin: 201 Created
```

This endpoint is typically used during agent provisioning and secure enrollment flows.

---

## 2. API Key Management

**Base Path:** `/api-keys`

Controller: `ApiKeyController`

Key features:

- List user API keys
- Create new API key
- Update metadata
- Delete key
- Regenerate secret

Authentication is derived from `AuthPrincipal`, ensuring API keys are scoped to the authenticated user.

```mermaid
flowchart LR
    User["Authenticated User"] --> Controller["ApiKeyController"]
    Controller --> Service["ApiKeyService"]
    Service --> Repo["BaseApiKeyRepository"]
```

Security Characteristics:

- User-scoped access
- Regeneration rotates secret while preserving key identity
- Creation returns secret only once

---

## 3. Device Status Updates

**Base Path:** `/devices`

Controller: `DeviceController`

Primary responsibility:

- Update device status via `PATCH /devices/{machineId}`

This is typically invoked internally by agents or system processes to reflect device health or connectivity state.

```mermaid
flowchart TD
    Agent["Agent"] --> Controller["DeviceController"]
    Controller --> Service["DeviceService"]
    Service --> DeviceDoc["Device Document"]
```

---

## 4. Force Agent Operations

**Base Path:** `/force`

Controller: `ForceAgentController`

Supports operational commands such as:

- Force tool installation
- Force tool reinstallation
- Force tool update
- Force client update
- Bulk operations ("all")

These endpoints delegate to:

- ForceToolInstallationService
- ForceClientUpdateService
- ForceToolAgentUpdateService

```mermaid
flowchart TD
    Admin["Admin Action"] --> Controller["ForceAgentController"]
    Controller --> InstallSvc["ForceToolInstallationService"]
    Controller --> UpdateSvc["ForceToolAgentUpdateService"]
    Controller --> ClientSvc["ForceClientUpdateService"]

    InstallSvc --> Kafka["Kafka Event"]
    UpdateSvc --> Kafka
    ClientSvc --> Kafka
```

These operations are typically asynchronous and propagate through event pipelines.

---

## 5. Health Check

**Path:** `/health`

Controller: `HealthController`

- Lightweight liveness endpoint
- Returns `200 OK` with body `OK`
- Used by orchestrators and load balancers

---

## 6. Invitations

**Base Path:** `/invitations`

Controller: `InvitationController`

Supports:

- Create invitation
- Paginated listing
- Revoke invitation
- Resend invitation

```mermaid
sequenceDiagram
    participant Admin
    participant Controller as InvitationController
    participant Service as InvitationService

    Admin->>Controller: POST /invitations
    Controller->>Service: createInvitation(request)
    Service-->>Controller: InvitationResponse
    Controller-->>Admin: 201 Created
```

Invitation flows integrate with SSO and tenant onboarding subsystems.

---

## 7. Current User Context

**Path:** `/me`

Controller: `MeController`

Purpose:

- Exposes authenticated user context
- Returns identity, roles, tenant ID
- Returns 401 if no authenticated principal

```mermaid
flowchart TD
    Request["GET /me"] --> AuthCheck["AuthPrincipal Present?"]
    AuthCheck -->|"Yes"| Response["Return User Info"]
    AuthCheck -->|"No"| Unauthorized["401 Unauthorized"]
```

This endpoint is commonly used by frontend applications to bootstrap user state.

---

## 8. OpenFrame Client Configuration

**Base Path:** `/openframe-client/configuration`

Controller: `OpenFrameClientConfigurationController`

Provides configuration metadata used by the OpenFrame client application.

Delegates to:

- OpenFrameClientConfigurationQueryService

---

## 9. Organization Mutations

**Base Path:** `/organizations`

Controller: `OrganizationController`

Handles:

- Create organization
- Update organization
- Update status (ACTIVE / ARCHIVED)
- Check if archivable

```mermaid
flowchart TD
    Admin["Admin"] --> Controller["OrganizationController"]
    Controller --> CommandSvc["OrganizationCommandService"]
    Controller --> DomainSvc["OrganizationService"]
    CommandSvc --> Repo["Organization Repository"]
```

Archiving rules:

- Cannot archive if active devices exist
- May return `409 Conflict`

Read operations are intentionally separated into external-facing modules.

---

## 10. Release Version

**Base Path:** `/release-version`

Controller: `ReleaseVersionController`

Responsibilities:

- Return current platform release metadata
- Respond with 404 if not present

Used by:

- UI build metadata
- Agent compatibility checks
- Monitoring tools

---

## 11. SSO Configuration

**Base Path:** `/sso`

Controller: `SSOConfigController`

Supports:

- List enabled providers
- List available providers
- Retrieve configuration
- Create or update provider config
- Toggle enablement
- Delete configuration

```mermaid
flowchart TD
    Admin["Admin"] --> Controller["SSOConfigController"]
    Controller --> Service["SSOConfigService"]
    Service --> Strategy["Provider Strategy"]
    Strategy --> Provider["Google / Microsoft"]
```

This integrates with the Authorization Service Core and OAuth infrastructure.

---

## 12. User Management

**Base Path:** `/users`

Controller: `UserController`

Supports:

- Paginated listing
- Get by ID
- Update user
- Soft delete user

```mermaid
flowchart LR
    Admin["Admin"] --> Controller["UserController"]
    Controller --> Service["UserService"]
    Service --> Repo["User Repository"]
```

Soft deletion ensures audit integrity and traceability.

---

# Security Model

All controllers (except `/health`) rely on Spring Security and JWT-based authentication.

Authentication Flow:

```mermaid
flowchart TD
    Request["Incoming HTTP Request"] --> Filter["JWT Filter"]
    Filter --> Principal["AuthPrincipal"]
    Principal --> Controller["REST Controller"]
```

Key characteristics:

- Tenant-aware security context
- Role-based authorization
- Principal injection via `@AuthenticationPrincipal`
- Clear separation between authentication and business logic

---

# Design Principles

The Api Service Core Rest Controllers module follows these principles:

1. Thin controllers (no heavy business logic)
2. Explicit HTTP semantics (correct status codes)
3. DTO-based contract isolation
4. Clear separation of command vs query concerns
5. Tenant-aware multi-organization architecture

---

# Summary

The **Api Service Core Rest Controllers** module is the internal REST façade of the OpenFrame API Service Core. It orchestrates:

- Identity-scoped user operations
- Organization and tenant management
- API key lifecycle
- SSO configuration
- Agent lifecycle control
- Operational management endpoints

It serves as a critical integration layer between authenticated clients and the underlying domain, persistence, and event-driven infrastructure, ensuring a clean, secure, and maintainable API boundary.