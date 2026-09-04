package com.openframe.authz.service.sso.apple;

import com.openframe.authz.config.oidc.AppleSSOProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

import static com.openframe.authz.service.auth.strategy.AppleClientSecretFactory.APPLE_ISSUER;

/**
 * Verifies Apple identity tokens obtained by the NATIVE Sign in with Apple sheet
 * ({@code ASAuthorizationController}). These differ from the web flow's ID tokens in one way that
 * matters: the audience is the iOS app's <b>bundle id</b>, never the web Services ID — so this
 * verifier accepts only the configured {@code native-client-ids}.
 * <p>
 * The identity token alone is a bearer credential (replayable within its lifetime); callers must
 * pair verification with the single-use authorization-code exchange — see
 * {@link AppleAuthorizationCodeClient} — and, when the app supplies one, the nonce check here.
 */
@Slf4j
@Component
public class AppleNativeTokenVerifier {

    private final AppleSSOProperties appleProps;
    private volatile NimbusJwtDecoder decoder;

    public AppleNativeTokenVerifier(AppleSSOProperties appleProps) {
        this.appleProps = appleProps;
    }

    /**
     * @param identityToken the JWT from {@code ASAuthorizationAppleIDCredential.identityToken}
     * @param rawNonce      the un-hashed nonce the app generated for this authorization, or null;
     *                      when present, the token's {@code nonce} claim must equal its SHA-256 hex
     * @return the verified token
     * @throws OAuth2AuthenticationException with {@code invalid_grant} on any verification failure
     */
    public Jwt verify(String identityToken, String rawNonce) {
        List<String> allowedAudiences = appleProps.getNativeClientIds();
        if (allowedAudiences == null || allowedAudiences.isEmpty()) {
            throw invalidGrant("Native Apple sign-in is not configured (no native client ids).");
        }
        Jwt jwt;
        try {
            jwt = decoder().decode(identityToken);
        } catch (JwtException e) {
            log.warn("Apple native identity token rejected: {}", e.getMessage());
            throw invalidGrant("Invalid Apple identity token.");
        }
        if (jwt.getAudience() == null || jwt.getAudience().stream().noneMatch(allowedAudiences::contains)) {
            log.warn("Apple native identity token has unexpected audience: {}", jwt.getAudience());
            throw invalidGrant("Apple identity token audience is not an accepted app id.");
        }
        verifyNonce(jwt, rawNonce);
        return jwt;
    }

    private void verifyNonce(Jwt jwt, String rawNonce) {
        String tokenNonce = jwt.getClaimAsString("nonce");
        // Mandatory: an optional nonce lets the caller opt out of replay binding by omitting a
        // field. The iOS client always generates one (raw to us, SHA-256 to Apple).
        if (rawNonce == null || rawNonce.isBlank()) {
            throw invalidGrant("Nonce is required.");
        }
        if (tokenNonce == null || !tokenNonce.equals(sha256Hex(rawNonce))) {
            log.warn("Apple native identity token nonce mismatch");
            throw invalidGrant("Apple identity token nonce mismatch.");
        }
    }

    private NimbusJwtDecoder decoder() {
        NimbusJwtDecoder local = decoder;
        if (local == null) {
            synchronized (this) {
                if (decoder == null) {
                    NimbusJwtDecoder built = NimbusJwtDecoder.withJwkSetUri(jwkSetUri()).build();
                    OAuth2TokenValidator<Jwt> issuerAndTimestamps = JwtValidators.createDefaultWithIssuer(APPLE_ISSUER);
                    built.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuerAndTimestamps, alwaysValid()));
                    decoder = built;
                }
                local = decoder;
            }
        }
        return local;
    }

    private String jwkSetUri() {
        String configured = appleProps.getJwkSetUri();
        return configured != null && !configured.isBlank() ? configured : APPLE_ISSUER + "/auth/keys";
    }

    /** Audience is validated against the configured list in {@link #verify}, not by the decoder. */
    private static OAuth2TokenValidator<Jwt> alwaysValid() {
        return token -> OAuth2TokenValidatorResult.success();
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static OAuth2AuthenticationException invalidGrant(String description) {
        return new OAuth2AuthenticationException(
                new OAuth2Error(OAuth2ErrorCodes.INVALID_GRANT, description, null));
    }
}
