package com.openframe.authz.service.sso.apple;

import com.openframe.authz.config.oidc.AppleSSOProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.security.KeyPair;
import java.util.List;
import java.util.Map;

import static com.openframe.authz.service.auth.strategy.AppleClientSecretFactory.APPLE_ISSUER;
import static com.openframe.authz.support.TestTokens.idToken;
import static com.openframe.authz.support.TestTokens.publicKey;
import static com.openframe.authz.support.TestTokens.rsaKeyPair;
import static com.openframe.authz.support.TestTokens.sha256Hex;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AppleNativeTokenVerifierTest {

    private static final String BUNDLE_ID = "com.openframe.app";
    private static final String RAW_NONCE = "raw-nonce-123";

    private final KeyPair appleKeys = rsaKeyPair();
    private final AppleSSOProperties props = new AppleSSOProperties();
    private AppleNativeTokenVerifier verifier;

    @BeforeEach
    void setUp() {
        props.setNativeClientIds(List.of(BUNDLE_ID));
        verifier = new AppleNativeTokenVerifier(props);
        // Same validation the verifier builds for Apple's JWKS, with a local key instead of a network fetch.
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(publicKey(appleKeys)).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(APPLE_ISSUER));
        ReflectionTestUtils.setField(verifier, "decoder", decoder);
    }

    private String token(String audience, String nonceClaim) {
        return idToken(appleKeys, APPLE_ISSUER, audience, "apple-sub",
                nonceClaim == null ? Map.of("email", "a@privaterelay.appleid.com") : Map.of("nonce", nonceClaim));
    }

    private static void assertInvalidGrant(Runnable call, String description) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(OAuth2AuthenticationException.class, e -> {
                    assertThat(e.getError().getErrorCode()).isEqualTo("invalid_grant");
                    assertThat(e.getError().getDescription()).contains(description);
                });
    }

    @Test
    void shouldAcceptTokenForTheAppWithHashedNonce() {
        assertThat(verifier.verify(token(BUNDLE_ID, sha256Hex(RAW_NONCE)), RAW_NONCE).getSubject()).isEqualTo("apple-sub");
    }

    @Test
    void shouldRefuseWhenNoNativeClientIdsAreConfigured() {
        props.setNativeClientIds(List.of());

        assertInvalidGrant(() -> verifier.verify(token(BUNDLE_ID, sha256Hex(RAW_NONCE)), RAW_NONCE), "not configured");
    }

    @Test
    void shouldRejectTokenForAnotherAudience() {
        assertInvalidGrant(() -> verifier.verify(token("com.openframe.web", sha256Hex(RAW_NONCE)), RAW_NONCE), "audience");
    }

    @Test
    void shouldRejectTokenSignedByAnotherKey() {
        String forged = idToken(rsaKeyPair(), APPLE_ISSUER, BUNDLE_ID, "apple-sub", Map.of("nonce", sha256Hex(RAW_NONCE)));

        assertInvalidGrant(() -> verifier.verify(forged, RAW_NONCE), "Invalid Apple identity token");
    }

    @Test
    void shouldRejectTokenFromAnotherIssuer() {
        String foreign = idToken(appleKeys, "https://evil.example.com", BUNDLE_ID, "apple-sub", Map.of("nonce", sha256Hex(RAW_NONCE)));

        assertInvalidGrant(() -> verifier.verify(foreign, RAW_NONCE), "Invalid Apple identity token");
    }

    @Test
    void shouldRequireNonce() {
        assertInvalidGrant(() -> verifier.verify(token(BUNDLE_ID, sha256Hex(RAW_NONCE)), null), "Nonce is required");
        assertInvalidGrant(() -> verifier.verify(token(BUNDLE_ID, sha256Hex(RAW_NONCE)), " "), "Nonce is required");
    }

    @Test
    void shouldRejectNonceMismatchOrUnhashedNonce() {
        assertInvalidGrant(() -> verifier.verify(token(BUNDLE_ID, sha256Hex("other")), RAW_NONCE), "nonce mismatch");
        assertInvalidGrant(() -> verifier.verify(token(BUNDLE_ID, RAW_NONCE), RAW_NONCE), "nonce mismatch");
        assertInvalidGrant(() -> verifier.verify(token(BUNDLE_ID, null), RAW_NONCE), "nonce mismatch");
    }
}
