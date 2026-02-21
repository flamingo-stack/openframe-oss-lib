# Security Best Practices

OpenFrame OSS Lib implements **enterprise-grade security** with multi-tenant isolation, asymmetric JWT authentication, OAuth2 authorization, and comprehensive access control. This guide covers security architecture, implementation patterns, and best practices.

## Security Architecture Overview

OpenFrame employs a **defense-in-depth** security model with multiple layers of protection:

```mermaid
flowchart TD
    subgraph "Transport Security"
        TLS["TLS 1.3 Encryption"]
        HSTS["HTTP Strict Transport Security"]
    end

    subgraph "Authentication Layer"
        JWT["Asymmetric JWT (RS256)"]
        OAuth2["OAuth2 + OIDC"]
        APIKeys["API Key Authentication"]
        MFA["Multi-Factor Authentication"]
    end

    subgraph "Authorization Layer"
        RBAC["Role-Based Access Control"]
        TenantIsolation["Multi-Tenant Isolation"]
        ResourceScoping["Resource-Level Permissions"]
        RateLimit["Rate Limiting & Quotas"]
    end

    subgraph "Data Protection"
        Encryption["Data Encryption at Rest"]
        KeyManagement["Key Management"]
        SecretRotation["Secret Rotation"]
        DataMasking["Sensitive Data Masking"]
    end

    subgraph "Audit & Monitoring"
        AuditLogs["Comprehensive Audit Logging"]
        SecurityEvents["Security Event Monitoring"]
        Alerting["Real-time Security Alerts"]
        Compliance["Compliance Reporting"]
    end

    TLS --> JWT
    JWT --> RBAC
    OAuth2 --> RBAC
    APIKeys --> RateLimit
    RBAC --> Encryption
    TenantIsolation --> KeyManagement
    Encryption --> AuditLogs
```

## Authentication Patterns

### 1. Asymmetric JWT Authentication (RS256)

OpenFrame uses **RS256 asymmetric cryptography** for JWT token validation, enabling distributed verification without shared secrets.

#### Key Management Architecture

```mermaid
flowchart LR
    TenantA[Tenant A] --> KeyPairA[RSA Key Pair A]
    TenantB[Tenant B] --> KeyPairB[RSA Key Pair B]
    TenantC[Tenant C] --> KeyPairC[RSA Key Pair C]

    KeyPairA --> PrivateKeyA[Private Key A<br/>JWT Signing]
    KeyPairA --> PublicKeyA[Public Key A<br/>JWT Validation]
    
    KeyPairB --> PrivateKeyB[Private Key B<br/>JWT Signing]
    KeyPairB --> PublicKeyB[Public Key B<br/>JWT Validation]
    
    KeyPairC --> PrivateKeyC[Private Key C<br/>JWT Signing]
    KeyPairC --> PublicKeyC[Public Key C<br/>JWT Validation]

    PrivateKeyA --> AuthServer[Authorization Server]
    PrivateKeyB --> AuthServer
    PrivateKeyC --> AuthServer

    PublicKeyA --> Gateway[API Gateway]
    PublicKeyB --> Gateway  
    PublicKeyC --> Gateway
```

#### Implementation Pattern

```java
@Service
@RequiredArgsConstructor
public class JwtService {
    private final TenantKeyService tenantKeyService;
    
    public String generateToken(AuthPrincipal principal) {
        // Get tenant-specific private key
        RSAPrivateKey privateKey = tenantKeyService
            .getPrivateKey(principal.getTenantId());
            
        return Jwts.builder()
            .setSubject(principal.getUserId())
            .setIssuer(getIssuerForTenant(principal.getTenantId()))
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + TOKEN_EXPIRY))
            .claim("tenantId", principal.getTenantId())
            .claim("email", principal.getEmail())
            .claim("roles", principal.getRoles())
            .signWith(privateKey, SignatureAlgorithm.RS256)
            .compact();
    }
    
    public DecodedJWT validateToken(String token) {
        String tenantId = extractTenantFromToken(token);
        RSAPublicKey publicKey = tenantKeyService.getPublicKey(tenantId);
        
        return JWT.require(Algorithm.RSA256(publicKey, null))
            .withIssuer(getIssuerForTenant(tenantId))
            .build()
            .verify(token);
    }
}
```

#### Security Benefits

✅ **No shared secrets** - Public keys can be distributed safely  
✅ **Tenant isolation** - Each tenant has unique key pairs  
✅ **Scalable validation** - Services can validate tokens independently  
✅ **Key rotation** - Private keys can be rotated without service coordination  

### 2. OAuth2 Authorization Code + PKCE Flow

For web and mobile applications, OpenFrame implements **OAuth2 Authorization Code flow with PKCE** (Proof Key for Code Exchange) for enhanced security.

#### PKCE Flow Implementation

```mermaid
sequenceDiagram
    participant Client as Client App
    participant BFF as OAuth BFF
    participant AuthSrv as Auth Server
    participant ResourceSrv as Resource Server

    Client->>Client: Generate code_verifier + code_challenge
    Client->>BFF: /oauth/authorize + code_challenge
    BFF->>AuthSrv: Authorization request + PKCE
    AuthSrv->>Client: Authorization UI
    Client->>AuthSrv: User credentials + consent
    AuthSrv->>BFF: Authorization code
    BFF->>AuthSrv: Token exchange + code_verifier
    AuthSrv->>AuthSrv: Verify PKCE challenge
    AuthSrv->>BFF: Access + Refresh tokens
    BFF->>Client: Set secure cookies
    Client->>ResourceSrv: API request with cookie
    ResourceSrv->>BFF: Extract token from cookie
    BFF->>ResourceSrv: JWT token
    ResourceSrv->>Client: API response
```

#### PKCE Security Configuration

```java
@Configuration
@EnableWebSecurity
public class OAuth2SecurityConfig {

    @Bean
    public SecurityFilterChain authorizationServerSecurityFilterChain(
            HttpSecurity http) throws Exception {
        
        OAuth2AuthorizationServerConfiguration
            .applyDefaultSecurity(http);
            
        http.oauth2AuthorizationServer(oauth2 ->
            oauth2.authorizationEndpoint(authz ->
                authz.authorizationRequestConverter(pkceAuthorizationRequestConverter())
            )
        );
        
        return http.build();
    }
    
    @Bean
    public AuthorizationRequestConverter pkceAuthorizationRequestConverter() {
        return new PKCEAuthorizationRequestConverter();
    }
}

@Component
public class PKCEAuthorizationRequestConverter 
        implements AuthorizationRequestConverter {
    
    @Override
    public OAuth2AuthorizationRequest convert(HttpServletRequest request) {
        String codeChallenge = request.getParameter("code_challenge");
        String codeChallengeMethod = request.getParameter("code_challenge_method");
        
        if (codeChallenge == null) {
            throw new OAuth2AuthorizationException("PKCE code_challenge required");
        }
        
        return OAuth2AuthorizationRequest.authorizationCode()
            .clientId(request.getParameter("client_id"))
            .redirectUri(request.getParameter("redirect_uri"))
            .scopes(parseScopes(request.getParameter("scope")))
            .state(request.getParameter("state"))
            .additionalParameters(Map.of(
                "code_challenge", codeChallenge,
                "code_challenge_method", codeChallengeMethod != null 
                    ? codeChallengeMethod : "S256"
            ))
            .build();
    }
}
```

### 3. API Key Authentication

For programmatic access, OpenFrame provides **API key authentication** with comprehensive usage tracking and rate limiting.

#### API Key Structure

```text
Format: ak_1a2b3c4d5e6f7890.sk_live_abcdefghijklmnopqrstuvwxyz123456
        ↑                   ↑
        Key ID              Secret Key
```

#### Implementation Pattern

```java
@Component
@RequiredArgsConstructor  
public class ApiKeyAuthenticationFilter implements Filter {
    private final ApiKeyValidationService apiKeyService;
    private final RateLimitService rateLimitService;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String apiKey = extractApiKey(httpRequest);
        
        if (apiKey != null) {
            try {
                // Validate API key and extract tenant context
                ApiKeyPrincipal principal = apiKeyService.validateApiKey(apiKey);
                
                // Check rate limits
                if (!rateLimitService.isAllowed(principal)) {
                    sendRateLimitResponse((HttpServletResponse) response);
                    return;
                }
                
                // Track usage statistics
                apiKeyService.recordUsage(principal, httpRequest);
                
                // Set security context
                SecurityContextHolder.getContext()
                    .setAuthentication(new ApiKeyAuthentication(principal));
                    
            } catch (InvalidApiKeyException e) {
                sendUnauthorizedResponse((HttpServletResponse) response);
                return;
            }
        }
        
        chain.doFilter(request, response);
    }
}

@Service
@RequiredArgsConstructor
public class ApiKeyValidationService {
    private final ApiKeyRepository apiKeyRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    
    @Cacheable(value = "api-keys", key = "#keyId")
    public ApiKeyPrincipal validateApiKey(String apiKey) {
        String[] parts = apiKey.split("\\.");
        if (parts.length != 2) {
            throw new InvalidApiKeyException("Invalid API key format");
        }
        
        String keyId = parts[0];
        String secretKey = parts[1];
        
        ApiKey storedKey = apiKeyRepository.findByKeyId(keyId)
            .orElseThrow(() -> new InvalidApiKeyException("API key not found"));
            
        if (!passwordEncoder.matches(secretKey, storedKey.getHashedSecret())) {
            throw new InvalidApiKeyException("Invalid API key secret");
        }
        
        if (!storedKey.isActive()) {
            throw new InvalidApiKeyException("API key is disabled");
        }
        
        return ApiKeyPrincipal.builder()
            .keyId(keyId)
            .tenantId(storedKey.getTenantId())
            .permissions(storedKey.getPermissions())
            .rateLimit(storedKey.getRateLimit())
            .build();
    }
}
```

## Authorization Patterns

### 1. Role-Based Access Control (RBAC)

OpenFrame implements a flexible RBAC system with tenant-scoped roles and permissions.

#### Role Hierarchy

```mermaid
flowchart TD
    Owner["OWNER<br/>(Full tenant access)"]
    Admin["ADMIN<br/>(User & resource management)"]
    User["USER<br/>(Read/write access)"]
    ReadOnly["READ_ONLY<br/>(View-only access)"]
    Agent["AGENT<br/>(Machine agent access)"]

    Owner --> Admin
    Admin --> User
    User --> ReadOnly
    
    Owner -.-> Agent
    Admin -.-> Agent
```

#### Permission Enforcement

```java
@RestController
@RequestMapping("/api/organizations")
@PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
public class OrganizationController {
    
    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<OrganizationResponse> createOrganization(
        @Valid @RequestBody CreateOrganizationRequest request,
        @AuthenticationPrincipal AuthPrincipal principal
    ) {
        // Only OWNER can create organizations
        return ResponseEntity.ok(
            organizationService.create(request, principal.getTenantId())
        );
    }
    
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'USER', 'READ_ONLY')")
    public ResponseEntity<OrganizationResponse> getOrganization(
        @PathVariable String id,
        @AuthenticationPrincipal AuthPrincipal principal
    ) {
        // All authenticated users can read organizations
        return ResponseEntity.ok(
            organizationService.findById(id, principal.getTenantId())
        );
    }
}
```

### 2. Multi-Tenant Data Isolation

**Critical Security Principle**: All data access must be tenant-scoped to prevent cross-tenant data leakage.

#### Repository Pattern with Tenant Isolation

```java
@Repository
public interface DeviceRepository extends MongoRepository<Device, String> {
    
    // ✅ CORRECT: Tenant-scoped query
    @Query("{ 'tenantId': ?0, 'status': ?1 }")
    Page<Device> findByTenantAndStatus(String tenantId, DeviceStatus status, Pageable pageable);
    
    // ❌ WRONG: Global query without tenant context
    // Page<Device> findByStatus(DeviceStatus status, Pageable pageable);
    
    // ✅ CORRECT: Composite query with tenant isolation
    @Query("{ 'tenantId': ?0, 'organizationId': ?1, 'lastSeen': { '$gte': ?2 } }")
    List<Device> findActiveDevicesByTenantAndOrganization(
        String tenantId, String organizationId, LocalDateTime since);
}

@Service
@RequiredArgsConstructor
public class DeviceService {
    private final DeviceRepository deviceRepository;
    
    public Page<Device> getDevices(String tenantId, DeviceFilter filter, Pageable pageable) {
        // Always include tenant context in queries
        return deviceRepository.findByTenantAndStatus(
            tenantId, 
            filter.getStatus(), 
            pageable
        );
    }
    
    public Device getDeviceById(String deviceId, String tenantId) {
        return deviceRepository.findById(deviceId)
            .filter(device -> device.getTenantId().equals(tenantId))
            .orElseThrow(() -> new DeviceNotFoundException(deviceId));
    }
}
```

### 3. Resource-Level Permissions

For fine-grained access control, implement resource-level permissions:

```java
@Component
@RequiredArgsConstructor
public class ResourcePermissionEvaluator implements PermissionEvaluator {
    private final DeviceService deviceService;
    private final OrganizationService organizationService;
    
    @Override
    public boolean hasPermission(Authentication authentication, Object targetDomainObject, 
                                Object permission) {
        
        if (!(authentication.getPrincipal() instanceof AuthPrincipal)) {
            return false;
        }
        
        AuthPrincipal principal = (AuthPrincipal) authentication.getPrincipal();
        
        // Device-level permissions
        if (targetDomainObject instanceof Device) {
            Device device = (Device) targetDomainObject;
            return device.getTenantId().equals(principal.getTenantId())
                && hasDevicePermission(principal, device, permission.toString());
        }
        
        // Organization-level permissions
        if (targetDomainObject instanceof Organization) {
            Organization org = (Organization) targetDomainObject;
            return org.getTenantId().equals(principal.getTenantId())
                && hasOrganizationPermission(principal, org, permission.toString());
        }
        
        return false;
    }
    
    private boolean hasDevicePermission(AuthPrincipal principal, Device device, String permission) {
        // Implement device-specific permission logic
        return switch (permission) {
            case "READ" -> principal.hasAnyRole("OWNER", "ADMIN", "USER", "READ_ONLY");
            case "WRITE" -> principal.hasAnyRole("OWNER", "ADMIN", "USER");
            case "DELETE" -> principal.hasAnyRole("OWNER", "ADMIN");
            default -> false;
        };
    }
}
```

## Data Protection

### 1. Encryption at Rest

Sensitive data must be encrypted before storage:

```java
@Component
@RequiredArgsConstructor
public class EncryptionService {
    private final AESUtil aesUtil;
    
    @Value("${openframe.security.encryption.secret-key}")
    private String encryptionKey;
    
    public String encrypt(String plaintext, String tenantId) {
        // Use tenant-specific salt for additional security
        String salt = generateTenantSalt(tenantId);
        return aesUtil.encrypt(plaintext, encryptionKey, salt);
    }
    
    public String decrypt(String ciphertext, String tenantId) {
        String salt = generateTenantSalt(tenantId);
        return aesUtil.decrypt(ciphertext, encryptionKey, salt);
    }
    
    private String generateTenantSalt(String tenantId) {
        return DigestUtils.sha256Hex(tenantId + encryptionKey).substring(0, 16);
    }
}

// Usage in entity classes
@Document(collection = "sso_configs")
public class SSOConfig {
    @Id
    private String id;
    private String tenantId;
    private String providerId;
    
    @JsonIgnore
    private String encryptedClientSecret;
    
    // Helper methods for transparent encryption/decryption
    public void setClientSecret(String clientSecret) {
        this.encryptedClientSecret = encryptionService.encrypt(clientSecret, tenantId);
    }
    
    public String getClientSecret() {
        return encryptionService.decrypt(encryptedClientSecret, tenantId);
    }
}
```

### 2. Secret Management

Implement proper secret rotation and management:

```java
@Service
@RequiredArgsConstructor
public class SecretRotationService {
    private final TenantKeyService tenantKeyService;
    private final JwtService jwtService;
    private final NotificationService notificationService;
    
    @Scheduled(cron = "0 0 2 * * 0") // Weekly rotation
    public void rotateExpiredKeys() {
        List<Tenant> tenants = tenantRepository.findAll();
        
        for (Tenant tenant : tenants) {
            TenantKey currentKey = tenantKeyService.getCurrentKey(tenant.getId());
            
            if (shouldRotateKey(currentKey)) {
                rotateKeyForTenant(tenant);
            }
        }
    }
    
    private void rotateKeyForTenant(Tenant tenant) {
        try {
            // Generate new key pair
            AuthenticationKeyPair newKeyPair = keyGenerator.generate();
            
            // Store new key with overlap period
            tenantKeyService.addKey(tenant.getId(), newKeyPair, KeyStatus.PENDING);
            
            // Activate new key after grace period
            scheduledExecutorService.schedule(() -> {
                tenantKeyService.activateKey(tenant.getId(), newKeyPair.getKeyId());
                tenantKeyService.markKeyDeprecated(tenant.getId(), currentKey.getKeyId());
            }, 24, TimeUnit.HOURS);
            
            // Notify tenant administrators
            notificationService.sendKeyRotationNotification(tenant);
            
        } catch (Exception e) {
            log.error("Failed to rotate key for tenant: {}", tenant.getId(), e);
            notificationService.sendKeyRotationError(tenant, e);
        }
    }
}
```

### 3. Sensitive Data Masking

Implement data masking for logs and audit trails:

```java
@Component
public class DataMaskingService {
    
    private static final Pattern EMAIL_PATTERN = 
        Pattern.compile("([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})");
    private static final Pattern PHONE_PATTERN = 
        Pattern.compile("\\b\\d{3}-\\d{3}-\\d{4}\\b");
    
    public String maskSensitiveData(String input) {
        if (input == null) return null;
        
        String masked = input;
        
        // Mask email addresses
        masked = EMAIL_PATTERN.matcher(masked)
            .replaceAll(result -> maskEmail(result.group()));
            
        // Mask phone numbers
        masked = PHONE_PATTERN.matcher(masked)
            .replaceAll("XXX-XXX-XXXX");
            
        return masked;
    }
    
    private String maskEmail(String email) {
        String[] parts = email.split("@");
        if (parts.length != 2) return email;
        
        String username = parts[0];
        String domain = parts[1];
        
        if (username.length() <= 2) {
            return "XX@" + domain;
        }
        
        return username.charAt(0) + 
               "X".repeat(username.length() - 2) + 
               username.charAt(username.length() - 1) + 
               "@" + domain;
    }
}
```

## Rate Limiting and DDoS Protection

### 1. Multi-Level Rate Limiting

Implement rate limiting at multiple levels:

```java
@Service
@RequiredArgsConstructor
public class RateLimitService {
    private final RedisTemplate<String, String> redisTemplate;
    
    public boolean isAllowed(String identifier, RateLimitWindow window, int limit) {
        String key = buildRateLimitKey(identifier, window);
        String currentCountStr = redisTemplate.opsForValue().get(key);
        
        int currentCount = currentCountStr != null ? Integer.parseInt(currentCountStr) : 0;
        
        if (currentCount >= limit) {
            return false;
        }
        
        // Increment counter with sliding window
        redisTemplate.opsForValue().increment(key);
        redisTemplate.expire(key, window.getDuration());
        
        return true;
    }
    
    // API Key rate limiting
    public boolean isApiKeyAllowed(ApiKeyPrincipal principal) {
        String keyId = principal.getKeyId();
        
        // Per-minute limit
        if (!isAllowed("api_key:" + keyId, RateLimitWindow.MINUTE, 100)) {
            return false;
        }
        
        // Per-hour limit
        if (!isAllowed("api_key:" + keyId, RateLimitWindow.HOUR, 1000)) {
            return false;
        }
        
        // Per-day limit based on tier
        int dailyLimit = principal.getTier().getDailyLimit();
        return isAllowed("api_key:" + keyId, RateLimitWindow.DAY, dailyLimit);
    }
    
    // Tenant-level rate limiting
    public boolean isTenantAllowed(String tenantId) {
        return isAllowed("tenant:" + tenantId, RateLimitWindow.MINUTE, 1000);
    }
    
    // IP-based rate limiting for DDoS protection
    public boolean isIpAllowed(String ipAddress) {
        return isAllowed("ip:" + ipAddress, RateLimitWindow.MINUTE, 60);
    }
}
```

### 2. Gateway-Level Protection

```java
@Component
public class RateLimitingGatewayFilter implements GatewayFilter {
    private final RateLimitService rateLimitService;
    
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String clientIp = getClientIp(request);
        
        // IP-based rate limiting
        if (!rateLimitService.isIpAllowed(clientIp)) {
            return handleRateLimit(exchange, "IP rate limit exceeded");
        }
        
        // Extract tenant context for tenant-level limiting
        return extractTenantId(request)
            .flatMap(tenantId -> {
                if (!rateLimitService.isTenantAllowed(tenantId)) {
                    return handleRateLimit(exchange, "Tenant rate limit exceeded");
                }
                return chain.filter(exchange);
            })
            .switchIfEmpty(chain.filter(exchange));
    }
    
    private Mono<Void> handleRateLimit(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
        response.getHeaders().add("X-RateLimit-Limit", "100");
        response.getHeaders().add("X-RateLimit-Remaining", "0");
        response.getHeaders().add("Retry-After", "60");
        
        String body = "{\"error\":\"" + message + "\"}";
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes());
        return response.writeWith(Mono.just(buffer));
    }
}
```

## Security Monitoring and Auditing

### 1. Comprehensive Audit Logging

```java
@Aspect
@Component
@RequiredArgsConstructor
public class AuditLoggingAspect {
    private final AuditEventService auditService;
    
    @AfterReturning(pointcut = "@annotation(auditable)", returning = "result")
    public void logAuditEvent(JoinPoint joinPoint, Auditable auditable, Object result) {
        try {
            AuthPrincipal principal = getCurrentPrincipal();
            String action = auditable.action().isEmpty() ? 
                joinPoint.getSignature().getName() : auditable.action();
            
            AuditEvent event = AuditEvent.builder()
                .tenantId(principal.getTenantId())
                .userId(principal.getUserId())
                .action(action)
                .resourceType(auditable.resourceType())
                .resourceId(extractResourceId(joinPoint, result))
                .ipAddress(getCurrentIpAddress())
                .userAgent(getCurrentUserAgent())
                .timestamp(Instant.now())
                .success(true)
                .build();
                
            auditService.recordEvent(event);
            
        } catch (Exception e) {
            log.warn("Failed to record audit event", e);
        }
    }
    
    @AfterThrowing(pointcut = "@annotation(auditable)", throwing = "exception")
    public void logFailedAuditEvent(JoinPoint joinPoint, Auditable auditable, Throwable exception) {
        // Log failed operations for security monitoring
    }
}

// Usage
@RestController
public class DeviceController {
    
    @PutMapping("/{id}/status")
    @Auditable(action = "UPDATE_DEVICE_STATUS", resourceType = "DEVICE")
    public ResponseEntity<Void> updateDeviceStatus(
        @PathVariable String id,
        @RequestBody UpdateStatusRequest request
    ) {
        deviceService.updateStatus(id, request);
        return ResponseEntity.ok().build();
    }
}
```

### 2. Security Event Monitoring

```java
@Service
@RequiredArgsConstructor
public class SecurityEventMonitor {
    private final NotificationService notificationService;
    private final RedisTemplate<String, Object> redisTemplate;
    
    @EventListener
    public void handleAuthenticationFailure(AuthenticationFailureEvent event) {
        String identifier = extractIdentifier(event);
        
        // Track failed login attempts
        String key = "auth_failures:" + identifier;
        Long failures = redisTemplate.opsForValue().increment(key);
        redisTemplate.expire(key, Duration.ofMinutes(15));
        
        if (failures >= 5) {
            SecurityAlert alert = SecurityAlert.builder()
                .type(SecurityAlertType.BRUTE_FORCE_ATTACK)
                .severity(AlertSeverity.HIGH)
                .identifier(identifier)
                .failureCount(failures)
                .timestamp(Instant.now())
                .build();
                
            notificationService.sendSecurityAlert(alert);
            
            // Temporarily block IP/user
            rateLimitService.blockIdentifier(identifier, Duration.ofHours(1));
        }
    }
    
    @EventListener
    public void handleSuspiciousActivity(SuspiciousActivityEvent event) {
        // Detect patterns like:
        // - Multiple tenant access attempts
        // - Unusual API usage patterns
        // - Geographic anomalies
        // - Privilege escalation attempts
        
        if (isHighRiskActivity(event)) {
            SecurityAlert alert = SecurityAlert.builder()
                .type(SecurityAlertType.SUSPICIOUS_ACTIVITY)
                .severity(AlertSeverity.CRITICAL)
                .details(event.getDetails())
                .timestamp(Instant.now())
                .build();
                
            notificationService.sendSecurityAlert(alert);
        }
    }
}
```

## Security Testing and Validation

### 1. Security Test Patterns

```java
@SpringBootTest
@TestPropertySource(properties = {
    "openframe.security.jwt.secret-key=test-key",
    "spring.profiles.active=test"
})
class SecurityIntegrationTest {
    
    @Autowired
    private TestRestTemplate restTemplate;
    
    @Test
    void shouldRejectUnauthorizedRequest() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/devices", String.class);
            
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
    
    @Test  
    void shouldRejectCrossTenantAccess() {
        String tenantAToken = generateTokenForTenant("tenant-a");
        String tenantBDeviceId = "device-belongs-to-tenant-b";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(tenantAToken);
        HttpEntity<String> entity = new HttpEntity<>(headers);
        
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/devices/" + tenantBDeviceId,
            HttpMethod.GET,
            entity,
            String.class
        );
        
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
    
    @Test
    void shouldEnforceRateLimit() {
        String apiKey = "test-api-key";
        
        // Make requests up to the limit
        for (int i = 0; i < 100; i++) {
            ResponseEntity<String> response = makeApiRequest(apiKey);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        }
        
        // Next request should be rate limited
        ResponseEntity<String> response = makeApiRequest(apiKey);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }
}
```

### 2. Security Checklist for Development

#### Pre-Deployment Security Checklist

- [ ] **All endpoints require authentication** (except public health checks)
- [ ] **All database queries include tenant context** (`tenantId` parameter)
- [ ] **Sensitive data is encrypted** before storage
- [ ] **API keys are properly hashed** and never stored in plaintext
- [ ] **Rate limiting is configured** for all public endpoints
- [ ] **Input validation** is implemented for all request parameters
- [ ] **SQL injection protection** via parameterized queries
- [ ] **XSS protection** through proper output encoding
- [ ] **CSRF tokens** for state-changing operations
- [ ] **Audit logging** for all security-relevant operations

#### Code Review Security Focus Areas

- **Authentication bypass** attempts
- **Authorization logic** flaws
- **Cross-tenant data access** vulnerabilities  
- **Injection attack** vectors (SQL, NoSQL, LDAP)
- **Information disclosure** through error messages
- **Session management** weaknesses
- **Cryptographic implementation** errors

## Common Security Anti-Patterns to Avoid

### ❌ Wrong: Global Data Access

```java
// DON'T DO THIS - No tenant isolation
public List<Device> getAllDevices() {
    return deviceRepository.findAll();
}
```

### ✅ Correct: Tenant-Scoped Access

```java
// DO THIS - Always include tenant context
public List<Device> getDevicesForTenant(String tenantId) {
    return deviceRepository.findByTenantId(tenantId);
}
```

### ❌ Wrong: Hardcoded Secrets

```java
// DON'T DO THIS - Secrets in code
private static final String JWT_SECRET = "my-secret-key";
```

### ✅ Correct: Environment-Based Configuration

```java
// DO THIS - Externalized configuration
@Value("${openframe.security.jwt.secret-key}")
private String jwtSecretKey;
```

### ❌ Wrong: Role Hardcoding

```java
// DON'T DO THIS - Hardcoded role checks
if (user.getRole().equals("ADMIN")) {
    // Allow operation
}
```

### ✅ Correct: Flexible Permission System

```java
// DO THIS - Use Spring Security annotations
@PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
public void performAdminOperation() {
    // Operation implementation
}
```

---

**Next Steps:**
- **[Testing Guide](../testing/README.md)** - Security testing strategies
- **[Contributing Guidelines](../contributing/guidelines.md)** - Secure development practices
- **[Local Development](../setup/local-development.md)** - Security configuration for development

This security guide provides the foundation for building secure, multi-tenant applications with OpenFrame OSS Lib. Always follow the principle of **defense in depth** and regularly review security implementations against current best practices.