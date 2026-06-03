# Authorization Service Core Keys And Authorization Persistence

## Overview

The **Authorization Service Core Keys And Authorization Persistence** module is responsible for:

- Generating and managing tenant-scoped RSA signing keys
- Converting RSA keys to and from PEM format
- Persisting OAuth2 registered clients
- Persisting OAuth2 authorizations (authorization codes, access tokens, refresh tokens)
- Preserving PKCE metadata across the authorization lifecycle

This module forms the cryptographic and persistence backbone of the Authorization Server. It ensures that:

- Each tenant has a secure signing key used for JWT issuance
- OAuth2 clients are stored and reconstructed correctly
- Authorization state (including PKCE parameters) survives restarts and distributed deployments

It integrates tightly with Spring Authorization Server, MongoDB repositories, and the tenant-aware authorization server configuration.

---

## High-Level Architecture

```mermaid
flowchart TD
    ClientApp["OAuth2 Client Application"] --> AuthServer["Authorization Server"]

    subgraph key_layer["Tenant Key Layer"]
        TenantKeyService["TenantKeyService"] --> KeyGenerator["RsaAuthenticationKeyPairGenerator"]
        TenantKeyService --> PemUtil["PemUtil"]
        TenantKeyService --> TenantKeyRepo["TenantKeyRepository"]
        TenantKeyService --> EncryptionService["EncryptionService"]
    end

    subgraph client_layer["Client Registration Layer"]
        RegisteredRepo["MongoRegisteredClientRepository"] --> MongoClientRepo["RegisteredClientMongoRepository"]
    end

    subgraph auth_layer["Authorization Persistence Layer"]
        AuthService["MongoAuthorizationService"] --> AuthMapper["MongoAuthorizationMapper"]
        AuthService --> MongoAuthRepo["MongoOAuth2AuthorizationRepository"]
        AuthMapper --> MongoEntity["MongoOAuth2Authorization"]
    end

    AuthServer --> TenantKeyService
    AuthServer --> RegisteredRepo
    AuthServer --> AuthService
```

### Responsibilities by Layer

| Layer | Responsibility |
|--------|----------------|
| Tenant Key Layer | RSA key generation, encryption, and retrieval per tenant |
| Client Registration Layer | Persistent storage of OAuth2 RegisteredClient definitions |
| Authorization Persistence Layer | Persistent storage of authorization codes, access tokens, refresh tokens, and PKCE metadata |

---

## Tenant RSA Key Management

### Purpose

The Authorization Service must sign JWT access tokens and ID tokens. In a multi-tenant system, each tenant requires its own signing key to:

- Isolate cryptographic trust boundaries
- Support per-tenant key rotation
- Prevent cross-tenant token misuse

### Core Components

- `PemUtil`
- `RsaAuthenticationKeyPairGenerator`
- `TenantKeyService`

---

### PemUtil

`PemUtil` is a low-level utility that:

- Parses PEM-encoded RSA public/private keys
- Serializes RSA keys into PEM format
- Wraps base64 content into 64-character lines

Supported formats:

```text
-----BEGIN PUBLIC KEY-----
(base64)
-----END PUBLIC KEY-----

-----BEGIN PRIVATE KEY-----
(base64)
-----END PRIVATE KEY-----
```

This class ensures interoperability with external JWK and JWT libraries.

---

### RsaAuthenticationKeyPairGenerator

This Spring component generates RSA key pairs using configurable properties:

- Algorithm (for example, RSA)
- Key size (for example, 2048 or 4096)
- SecureRandom algorithm

Generation flow:

```mermaid
flowchart TD
    Start["Generate Key Pair"] --> InitRandom["Initialize SecureRandom"]
    InitRandom --> InitGenerator["Initialize KeyPairGenerator"]
    InitGenerator --> Generate["Generate RSA KeyPair"]
    Generate --> ConvertPem["Convert to PEM"]
    ConvertPem --> CreateKid["Create kid UUID"]
    CreateKid --> Result["Return AuthenticationKeyPair"]
```

Each generated key pair includes:

- RSAPublicKey
- RSAPrivateKey
- Public PEM
- Private PEM
- `kid` (Key ID) prefixed with `kid-`

The `kid` is later embedded into JWT headers.

---

### TenantKeyService

`TenantKeyService` provides the runtime contract used by the Authorization Server to retrieve signing keys.

#### Responsibilities

1. Retrieve active key for a tenant
2. Generate and persist a key if none exists
3. Encrypt private key material before persistence
4. Return a Nimbus `RSAKey` for signing

#### getOrCreateActiveKey Flow

```mermaid
flowchart TD
    Request["Request RSAKey for Tenant"] --> CheckActive["Check Active Key Count"]
    CheckActive --> Found{"Active Key Exists?"}
    Found -->|"Yes"| LoadDoc["Load TenantKey Document"]
    Found -->|"No"| Create["Generate New Key"]
    Create --> Encrypt["Encrypt Private PEM"]
    Encrypt --> Save["Save TenantKey"]
    Save --> LoadDoc
    LoadDoc --> Parse["Parse PEM to RSA Keys"]
    Parse --> BuildJwk["Build Nimbus RSAKey"]
    BuildJwk --> Return["Return RSAKey"]
```

#### Security Model

- Public key is stored in plaintext PEM.
- Private key is encrypted using `EncryptionService` before persistence.
- Only decrypted in-memory during signing operations.

If multiple active keys are detected for a tenant, a warning is logged to prevent `kid` mismatches.

---

## OAuth2 Client Persistence

### MongoRegisteredClientRepository

This class implements Spring Authorization Server's `RegisteredClientRepository` interface.

It acts as a bridge between:

- Spring `RegisteredClient`
- Mongo `MongoRegisteredClient` document

### Save Mapping

On save:

- Authentication methods are converted to string values
- Grant types are converted to string values
- Token TTL values are converted to seconds
- PKCE requirement flags are persisted

### Reconstruction Mapping

On retrieval:

- `ClientSettings` is rebuilt
- `TokenSettings` is rebuilt
- Authentication methods and grant types are rehydrated
- Redirect URIs and scopes are restored

This ensures full compatibility with Spring Authorization Server runtime expectations.

---

## OAuth2 Authorization Persistence

### Core Components

- `MongoAuthorizationService`
- `MongoAuthorizationMapper`

These classes implement and support Spring's `OAuth2AuthorizationService`.

---

## MongoAuthorizationMapper

This class converts between:

- `OAuth2Authorization` (Spring domain model)
- `MongoOAuth2Authorization` (Mongo document)

It persists:

- Authorization grant type
- Authorization code
- Access token
- Refresh token
- State
- PKCE parameters
- Authorization request snapshot

### PKCE Preservation Strategy

PKCE parameters (`code_challenge`, `code_challenge_method`) are captured from:

- OAuth2AuthorizationRequest additional parameters
- Authorization code metadata

They are normalized and stored in:

- `arAdditional`
- `authorizationCodeMetadata`

When reconstructing:

- PKCE keys are restored with underscore format
- Both dot and underscore variants are normalized
- OAuth2AuthorizationRequest is rebuilt

This ensures PKCE validation works correctly during token exchange.

---

## MongoAuthorizationService

Implements `OAuth2AuthorizationService`.

### Save Flow

```mermaid
flowchart TD
    SaveCall["Save Authorization"] --> ExtractPkce["Extract PKCE Parameters"]
    ExtractPkce --> MapEntity["Map to Mongo Entity"]
    MapEntity --> Persist["Save to Mongo"]
    Persist --> Verify["Debug Verify PKCE"]
```

### Token Lookup Flow

```mermaid
flowchart TD
    Lookup["Find By Token"] --> TypeCheck{"Token Type?"}
    TypeCheck -->|"Access"| AccessQuery["Find By Access Token"]
    TypeCheck -->|"Refresh"| RefreshQuery["Find By Refresh Token"]
    TypeCheck -->|"Code"| CodeQuery["Find By Authorization Code"]
    TypeCheck -->|"Null"| MultiQuery["Try All Token Fields"]
    AccessQuery --> MapBack["Map to Domain"]
    RefreshQuery --> MapBack
    CodeQuery --> MapBack
    MultiQuery --> MapBack
    MapBack --> ReturnAuth["Return OAuth2Authorization"]
```

It supports lookup by:

- Access token
- Refresh token
- Authorization code
- State

After retrieval, the entity is mapped back to `OAuth2Authorization`, ensuring:

- PKCE metadata is restored
- Principal placeholder is recreated
- Tokens are rebuilt with correct expiry

---

## End-to-End Authorization Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant AuthServer
    participant KeyService
    participant AuthService
    participant MongoDB

    User->>AuthServer: Authorization Request with PKCE
    AuthServer->>AuthService: Save OAuth2Authorization
    AuthService->>MongoDB: Persist Authorization Code
    AuthServer->>KeyService: Get Tenant Signing Key
    KeyService->>MongoDB: Load or Create TenantKey
    KeyService->>AuthServer: Return RSAKey
    AuthServer->>User: Issue JWT Access Token
    User->>AuthServer: Token Exchange
    AuthServer->>AuthService: Find Authorization by Code
    AuthService->>MongoDB: Retrieve Authorization
    AuthServer->>User: Return Access and Refresh Tokens
```

---

## Security Considerations

1. Private Key Encryption
   - Private RSA keys are encrypted before Mongo persistence.
   - Decrypted only when building the runtime RSAKey.

2. PKCE Integrity
   - PKCE values are preserved exactly as provided.
   - Underscore normalization avoids validation mismatches.

3. Token Expiry
   - TTL values are enforced through stored expiration timestamps.
   - Expired authorizations can be pruned by repository-level TTL logic.

4. Multi-Tenant Isolation
   - Each tenant has an isolated signing key.
   - Each authorization record references its registered client.

---

## Summary

The **Authorization Service Core Keys And Authorization Persistence** module provides:

- Cryptographically secure tenant-aware RSA key management
- Robust Mongo-backed OAuth2 client persistence
- Reliable authorization and token persistence
- Full PKCE support with metadata normalization
- Seamless integration with Spring Authorization Server

It is the foundation that guarantees secure JWT issuance, correct OAuth2 behavior, and multi-tenant isolation within the OpenFrame Authorization Server architecture.
