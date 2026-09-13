package com.openframe.management.scheduler;

import com.openframe.data.document.oauth.MongoRegisteredClient;
import com.openframe.data.repository.oauth.RegisteredClientMongoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

import static org.springframework.util.StringUtils.hasText;

/**
 * Creates the gateway's OAuth client on first start and keeps an existing one in line with the
 * current configuration: custom grants, authentication methods and client secret.
 * <p>
 * The secret should be configured as a BCrypt hash ({@code openframe.gateway.oauth.client-secret-hash}),
 * so only the gateway holds the plain value. The plain {@code openframe.gateway.oauth.client-secret} is
 * still accepted for deployments that have not moved to the hash.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(value = "openframe.management.idp.init.enabled", havingValue = "true")
public class IdpConfigurationScheduler implements InitializingBean {

    /** Grant used by the native Sign in with Apple exchange (see AppleNativeGrantAuthenticationToken). */
    private static final String APPLE_NATIVE_GRANT = "urn:openframe:params:oauth:grant-type:apple-native";
    /** Grant that redeems a bound mobile signup ticket (see SignupTicketGrantAuthenticationToken). */
    private static final String SIGNUP_TICKET_GRANT = "urn:openframe:params:oauth:grant-type:signup-ticket";

    private static final Set<String> CUSTOM_GRANTS = Set.of(APPLE_NATIVE_GRANT, SIGNUP_TICKET_GRANT);
    private static final Set<String> GRANTS = Set.of("authorization_code", "refresh_token", APPLE_NATIVE_GRANT, SIGNUP_TICKET_GRANT);
    /**
     * The gateway is a confidential client and always sends Basic auth. {@code none} is deliberately
     * absent: it would let anyone redeem an authorization code for this client with PKCE alone.
     */
    private static final Set<String> AUTHENTICATION_METHODS = Set.of("client_secret_basic");
    private static final Set<String> SCOPES = Set.of("openid", "profile", "email", "offline_access");

    /** Same shape {@code BCryptPasswordEncoder} accepts. */
    private static final Pattern BCRYPT_HASH = Pattern.compile("\\A\\$2[aby]?\\$\\d\\d\\$[./0-9A-Za-z]{53}\\z");

    private final RegisteredClientMongoRepository registeredClientMongoRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${openframe.gateway.oauth.client-id}")
    private String gatewayClientId;

    @Value("${openframe.gateway.oauth.client-secret-hash:}")
    private String gatewayClientSecretHash;

    @Value("${openframe.gateway.oauth.client-secret:}")
    private String gatewayClientSecret;

    @Value("${openframe.gateway.oauth.redirect-uri}")
    private String gatewayRedirectUri;

    @Value("${security.oauth2.token.access.expiration-seconds}")
    private long accessTokenExpirationSeconds;

    @Value("${security.oauth2.token.refresh.expiration-seconds}")
    private long refreshTokenExpirationSeconds;

    /** Fails startup on a missing or malformed secret instead of registering a client nobody can use. */
    @Override
    public void afterPropertiesSet() {
        if (hasText(gatewayClientSecretHash)) {
            if (!BCRYPT_HASH.matcher(gatewayClientSecretHash).matches()) {
                throw new IllegalStateException("openframe.gateway.oauth.client-secret-hash must be a BCrypt hash");
            }
        } else if (!hasText(gatewayClientSecret)) {
            throw new IllegalStateException(
                    "Set openframe.gateway.oauth.client-secret-hash (or openframe.gateway.oauth.client-secret)");
        }
    }

    @Scheduled(fixedDelay = Long.MAX_VALUE, initialDelay = 5000)
    @SchedulerLock(name = "IdpConfigurationScheduler_initializeDefaultIdp", lockAtMostFor = "10m", lockAtLeastFor = "1m")
    public void initializeDefaultIdp() {
        try {
            registeredClientMongoRepository.findByClientId(gatewayClientId)
                    .ifPresentOrElse(this::reconcile, this::create);
        } catch (RuntimeException e) {
            log.error("Failed to initialize default IdP client: {}", gatewayClientId, e);
            throw e;
        }
    }

    private void create() {
        MongoRegisteredClient client = MongoRegisteredClient.builder()
                .clientId(gatewayClientId)
                .clientSecret(configuredSecretHash())
                .authenticationMethods(AUTHENTICATION_METHODS)
                .grantTypes(GRANTS)
                .redirectUris(Set.of(gatewayRedirectUri))
                .scopes(SCOPES)
                .requireProofKey(true)
                .requireAuthorizationConsent(false)
                .accessTokenTtlSeconds(accessTokenExpirationSeconds)
                .refreshTokenTtlSeconds(refreshTokenExpirationSeconds)
                .reuseRefreshTokens(false)
                .build();

        registeredClientMongoRepository.save(client);
        log.info("Created default RegisteredClient: {} (redirect: {})", gatewayClientId, gatewayRedirectUri);
    }

    private void reconcile(MongoRegisteredClient client) {
        boolean grantsAdded = addMissingCustomGrants(client);
        boolean authenticationMethodsUpdated = syncAuthenticationMethods(client);
        boolean secretUpdated = syncClientSecret(client);

        if (!grantsAdded && !authenticationMethodsUpdated && !secretUpdated) {
            log.info("Registered OAuth client already exists: {}", gatewayClientId);
            return;
        }

        registeredClientMongoRepository.save(client);
        log.info("Updated RegisteredClient {}: customGrantsAdded={}, authenticationMethodsUpdated={}, secretUpdated={}",
                gatewayClientId, grantsAdded, authenticationMethodsUpdated, secretUpdated);
    }

    /**
     * Existing deployments predate the custom grants — upsert them, or the token endpoint rejects
     * the exchange with unauthorized_client.
     */
    private boolean addMissingCustomGrants(MongoRegisteredClient client) {
        Set<String> grants = client.getGrantTypes() == null ? new HashSet<>() : new HashSet<>(client.getGrantTypes());
        if (!grants.addAll(CUSTOM_GRANTS)) {
            return false;
        }
        client.setGrantTypes(grants);
        return true;
    }

    /** Existing deployments were registered with {@code none} as well — replace them with the configured set. */
    private boolean syncAuthenticationMethods(MongoRegisteredClient client) {
        if (AUTHENTICATION_METHODS.equals(client.getAuthenticationMethods())) {
            return false;
        }
        client.setAuthenticationMethods(AUTHENTICATION_METHODS);
        return true;
    }

    /**
     * The gateway authenticates with the configured secret, so a rotated secret must replace the
     * stored hash, or every token exchange fails with invalid_client.
     * <p>
     * Rotation: management applies the new hash once at startup and gateways read the secret only at
     * their own startup, so roll out the new secret and its hash together and restart management and
     * all gateways at the same time. Until both sides match, token exchange, refresh and revoke are rejected.
     */
    private boolean syncClientSecret(MongoRegisteredClient client) {
        if (storedSecretIsCurrent(client.getClientSecret())) {
            return false;
        }
        client.setClientSecret(configuredSecretHash());
        return true;
    }

    private boolean storedSecretIsCurrent(String storedHash) {
        if (storedHash == null) {
            return false;
        }
        return hasText(gatewayClientSecretHash)
                ? storedHash.equals(gatewayClientSecretHash)
                : passwordEncoder.matches(gatewayClientSecret, storedHash);
    }

    private String configuredSecretHash() {
        return hasText(gatewayClientSecretHash) ? gatewayClientSecretHash : passwordEncoder.encode(gatewayClientSecret);
    }
}
