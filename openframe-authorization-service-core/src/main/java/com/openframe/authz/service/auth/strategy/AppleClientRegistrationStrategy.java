package com.openframe.authz.service.auth.strategy;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.openframe.authz.config.oidc.AppleSSOProperties;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.sso.SSOConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.security.KeyFactory;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.config.oidc.AppleSSOProperties.APPLE;
import static org.springframework.security.oauth2.core.AuthorizationGrantType.AUTHORIZATION_CODE;
import static org.springframework.security.oauth2.core.ClientAuthenticationMethod.CLIENT_SECRET_POST;

/**
 * Sign in with Apple. Deliberately not built on {@link BaseOidcClientRegistrationStrategy}, because
 * Apple differs from a plain OIDC provider in two ways that the base hardcodes the other way:
 * <ul>
 *   <li>The {@code client_secret} is an ES256 JWT minted per request from the tenant's .p8 key
 *       (stored in the config's {@code clientSecret} field), not a static string. Building the
 *       registration per request via {@code DynamicClientRegistrationRepository} makes Apple's
 *       6-month secret-expiry a non-issue.</li>
 *   <li>Apple's token endpoint only accepts {@code client_secret_post}; the base uses Basic.</li>
 * </ul>
 * Apple also requires {@code response_mode=form_post} whenever the email or name scope is
 * requested — see {@link #additionalAuthorizationParams()}; the resulting cross-site POST callback
 * is why the SSO cookies need {@code SameSite=None} for this provider.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AppleClientRegistrationStrategy implements ClientRegistrationStrategy {

    private static final String APPLE_ISSUER = "https://appleid.apple.com";
    /** Apple caps the client-secret JWT at 6 months; a fresh one is minted per request, so keep it short. */
    private static final Duration CLIENT_SECRET_TTL = Duration.ofMinutes(5);

    private final SSOConfigService ssoConfigService;
    private final AppleSSOProperties appleProps;

    @Override
    public String providerId() {
        return APPLE;
    }

    @Override
    public Map<String, String> additionalAuthorizationParams() {
        return Map.of("response_mode", "form_post");
    }

    @Override
    public ClientRegistration buildClient(String tenantId) {
        SSOConfig cfg = ssoConfigService.getEffectiveSSOConfig(tenantId, APPLE)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No active SSO config for provider 'apple' (tenant-specific or default) and tenant " + tenantId));

        String privateKeyPem = ssoConfigService.getDecryptedClientSecret(cfg);
        String clientSecret = mintClientSecret(cfg, privateKeyPem);

        return ClientRegistration.withRegistrationId(APPLE)
                .clientId(cfg.getClientId())
                .clientSecret(clientSecret)
                .clientAuthenticationMethod(CLIENT_SECRET_POST)
                .authorizationGrantType(AUTHORIZATION_CODE)
                .redirectUri(appleProps.getLoginRedirectUri())
                .scope(appleProps.getScopes())
                .authorizationUri(appleProps.getAuthorizationUrl())
                .tokenUri(appleProps.getTokenUrl())
                .jwkSetUri(appleProps.getJwkSetUri())
                .issuerUri(APPLE_ISSUER)
                .userNameAttributeName(IdTokenClaimNames.SUB)
                .clientName("Apple (" + tenantId + ")")
                .build();
    }

    @Override
    public Optional<OAuth2TokenValidator<Jwt>> idTokenValidator(ClientRegistration registration) {
        return Optional.of(token -> {
            String issuer = token.getIssuer() != null ? token.getIssuer().toString() : null;
            if (APPLE_ISSUER.equals(issuer)) {
                return OAuth2TokenValidatorResult.success();
            }
            log.error("Apple issuer validation failed: issuer='{}'", issuer);
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_id_token", "Invalid issuer for Apple. Received: " + issuer, null));
        });
    }

    private String mintClientSecret(SSOConfig cfg, String privateKeyPem) {
        if (cfg.getTeamId() == null || cfg.getTeamId().isBlank()
                || cfg.getKeyId() == null || cfg.getKeyId().isBlank()) {
            throw new IllegalArgumentException(
                    "Apple SSO config is missing teamId or keyId; both are required to build the client secret JWT.");
        }
        try {
            Instant now = Instant.now();
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .issuer(cfg.getTeamId())
                    .subject(cfg.getClientId())
                    .audience(APPLE_ISSUER)
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(now.plus(CLIENT_SECRET_TTL)))
                    .build();
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(cfg.getKeyId()).build(),
                    claims);
            jwt.sign(new ECDSASigner(parseEcPrivateKey(privateKeyPem)));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to build Apple client secret JWT: " + e.getMessage(), e);
        }
    }

    /**
     * Accepts the .p8 as downloaded (PKCS#8 PEM), with or without literal {@code \n} escapes —
     * the key often travels through an env var that flattens newlines.
     */
    private static ECPrivateKey parseEcPrivateKey(String pem) throws Exception {
        String base64 = pem
                .replace("\\n", "\n")
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(base64);
        return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(der));
    }
}
