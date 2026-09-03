package com.openframe.management.scheduler;

import com.openframe.data.document.oauth.MongoRegisteredClient;
import com.openframe.data.repository.oauth.RegisteredClientMongoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashSet;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(value = "openframe.management.idp.init.enabled", havingValue = "true", matchIfMissing = false)
public class IdpConfigurationScheduler {

    private final RegisteredClientMongoRepository registeredClientMongoRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${openframe.gateway.oauth.client-id}")
    private String gatewayClientId;

    @Value("${openframe.gateway.oauth.client-secret}")
    private String gatewayClientSecret;

    @Value("${openframe.gateway.oauth.redirect-uri}")
    private String gatewayRedirectUri;

    @Value("${security.oauth2.token.access.expiration-seconds}")
    private long accessTokenExpirationSeconds;

    @Value("${security.oauth2.token.refresh.expiration-seconds}")
    private long refreshTokenExpirationSeconds;

    /** Grant used by the native Sign in with Apple exchange (see AppleNativeGrantAuthenticationToken). */
    private static final String APPLE_NATIVE_GRANT = "urn:openframe:params:oauth:grant-type:apple-native";
    /** Grant that redeems a bound mobile signup ticket (see SignupTicketGrantAuthenticationToken). */
    private static final String SIGNUP_TICKET_GRANT = "urn:openframe:params:oauth:grant-type:signup-ticket";

    @Scheduled(fixedDelay = Long.MAX_VALUE, initialDelay = 5000)
    @SchedulerLock(name = "IdpConfigurationScheduler_initializeDefaultIdp", lockAtMostFor = "10m", lockAtLeastFor = "1m")
    public void initializeDefaultIdp() {
        try {
            var existing = registeredClientMongoRepository.findByClientId(gatewayClientId);
            if (existing.isPresent()) {
                // Existing deployments predate the apple-native grant — upsert it, or the token
                // endpoint rejects the exchange with unauthorized_client.
                MongoRegisteredClient client = existing.get();
                Set<String> grants = new HashSet<>(
                        client.getGrantTypes() != null ? client.getGrantTypes() : Set.of());
                if (grants.addAll(Set.of(APPLE_NATIVE_GRANT, SIGNUP_TICKET_GRANT))) {
                    client.setGrantTypes(grants);
                    registeredClientMongoRepository.save(client);
                    log.info("Upserted custom grants on existing RegisteredClient: {}", gatewayClientId);
                } else {
                    log.info("Registered OAuth client already exists: {}", gatewayClientId);
                }
                return;
            }

            String encodedSecret = passwordEncoder.encode(gatewayClientSecret);

            MongoRegisteredClient client = MongoRegisteredClient.builder()
                .clientId(gatewayClientId)
                .clientSecret(encodedSecret)
                .authenticationMethods(Set.of("none", "client_secret_basic"))
                .grantTypes(Set.of("authorization_code", "refresh_token", APPLE_NATIVE_GRANT, SIGNUP_TICKET_GRANT))
                .redirectUris(Set.of(gatewayRedirectUri))
                .scopes(Set.of("openid", "profile", "email", "offline_access"))
                .requireProofKey(true)
                .requireAuthorizationConsent(false)
                .accessTokenTtlSeconds(accessTokenExpirationSeconds)
                .refreshTokenTtlSeconds(refreshTokenExpirationSeconds)
                .reuseRefreshTokens(false)
                .build();

            registeredClientMongoRepository.save(client);
            log.info("Created default RegisteredClient: {} (redirect: {})", gatewayClientId, gatewayRedirectUri);
        } catch (Exception e) {
            log.error("Failed to initialize default IdP client: {}", gatewayClientId, e);
            throw e;
        }
    }
}


