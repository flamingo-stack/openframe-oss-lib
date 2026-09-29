package com.openframe.security.jwt;

import com.nimbusds.jose.EncryptionMethod;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWEAlgorithm;
import com.nimbusds.jose.JWEHeader;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSAEncrypter;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.EncryptedJWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class GatewayVerifiedJwtDecoderTest {

    private static final String PLATFORM_ISSUER = "https://auth.openframe.example/tenant-1";
    private static final String FOREIGN_ISSUER = "https://another-platform.example";
    private static final Instant ISSUED_AT = Instant.parse("2020-01-01T00:00:00Z");
    private static final Instant EXPIRED_AT = Instant.parse("2020-01-01T00:15:00Z");
    private static final Instant EXPIRES_AT = Instant.parse("2100-01-01T00:15:00Z");
    private static final RSAKey UNKNOWN_KEY = generateUnknownKey();

    private final GatewayVerifiedJwtDecoder decoder = new GatewayVerifiedJwtDecoder();

    @ParameterizedTest
    @MethodSource("tokensOnlyTheGatewayChecks")
    void decode_tokenOnlyTheGatewayChecks_returnsItsCaller(String token) {
        Jwt jwt = decoder.decode(token);

        assertThat(jwt.getSubject()).isEqualTo("user-1");
    }

    @Test
    void decode_userToken_returnsItsClaims() {
        Jwt jwt = decoder.decode(signedWithUnknownKey(userClaims(PLATFORM_ISSUER, EXPIRES_AT)));

        assertThat(jwt.getClaims())
                .containsEntry("iss", PLATFORM_ISSUER)
                .containsEntry("sub", "user-1")
                .containsEntry("tenant_id", "tenant-1")
                .containsEntry("userId", "user-1")
                .containsEntry("roles", List.of("ADMIN", "OWNER"))
                .containsEntry("scope", "openid profile");
    }

    @Test
    void decode_expiredToken_returnsTimestampsAsInstants() {
        Jwt jwt = decoder.decode(signedWithUnknownKey(userClaims(PLATFORM_ISSUER, EXPIRED_AT)));

        assertThat(jwt.getClaims())
                .containsEntry("iat", ISSUED_AT)
                .containsEntry("exp", EXPIRED_AT);
    }

    @Test
    void decode_signedToken_keepsItsHeaders() {
        Jwt jwt = decoder.decode(signedWithUnknownKey(userClaims(PLATFORM_ISSUER, EXPIRES_AT)));

        assertThat(jwt.getHeaders())
                .containsEntry("alg", "RS256")
                .containsEntry("kid", "unknown-key");
    }

    @Test
    void decode_signedToken_keepsTheTokenValue() {
        String token = signedWithUnknownKey(userClaims(PLATFORM_ISSUER, EXPIRES_AT));

        Jwt jwt = decoder.decode(token);

        assertThat(jwt.getTokenValue()).isEqualTo(token);
    }

    @Test
    void decode_unsignedToken_keepsTheAlgNoneHeader() {
        Jwt jwt = decoder.decode(unsigned(userClaims(PLATFORM_ISSUER, EXPIRES_AT)));

        assertThat(jwt.getHeaders()).containsEntry("alg", "none");
    }

    @Test
    void decode_notAJwt_throwsBadJwtException() {
        assertThatThrownBy(() -> decoder.decode("not-a-jwt"))
                .isInstanceOf(BadJwtException.class)
                .hasMessage("Malformed token: Invalid JWT serialization: Missing dot delimiter(s)");
    }

    @Test
    void decode_claimsNotAJsonObject_throwsBadJwtException() {
        String token = unsignedWithRawPayload("[\"user-1\"]");

        assertThatThrownBy(() -> decoder.decode(token))
                .isInstanceOf(BadJwtException.class)
                .hasMessage("Malformed token claims: Payload of unsecured JOSE object is not a valid JSON object");
    }

    @Test
    void decode_expiryNotANumber_throwsBadJwtException() {
        String token = unsignedWithRawPayload("{\"sub\":\"user-1\",\"exp\":\"tomorrow\"}");

        assertThatThrownBy(() -> decoder.decode(token))
                .isInstanceOf(BadJwtException.class)
                .hasMessage("Malformed token claims: Unexpected type of JSON object member with key exp");
    }

    @Test
    void decode_noClaims_throwsBadJwtException() {
        String token = unsignedWithRawPayload("{}");

        assertThatThrownBy(() -> decoder.decode(token))
                .isInstanceOf(BadJwtException.class)
                .hasMessage("Malformed token claims: claims cannot be empty")
                .hasCauseInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void decode_encryptedToken_throwsBadJwtException() {
        String token = encrypted(userClaims(PLATFORM_ISSUER, EXPIRES_AT));

        assertThatThrownBy(() -> decoder.decode(token))
                .isInstanceOf(BadJwtException.class)
                .hasMessage("Encrypted tokens are not supported");
    }

    private static Stream<Arguments> tokensOnlyTheGatewayChecks() {
        return Stream.of(
                arguments(Named.of("signed with an unknown key",
                        signedWithUnknownKey(userClaims(PLATFORM_ISSUER, EXPIRES_AT)))),
                arguments(Named.of("unsigned",
                        unsigned(userClaims(PLATFORM_ISSUER, EXPIRES_AT)))),
                arguments(Named.of("expired",
                        signedWithUnknownKey(userClaims(PLATFORM_ISSUER, EXPIRED_AT)))),
                arguments(Named.of("issued by another platform",
                        signedWithUnknownKey(userClaims(FOREIGN_ISSUER, EXPIRES_AT)))));
    }

    private static JWTClaimsSet userClaims(String issuer, Instant expiresAt) {
        return new JWTClaimsSet.Builder()
                .issuer(issuer)
                .subject("user-1")
                .claim("tenant_id", "tenant-1")
                .claim("userId", "user-1")
                .claim("roles", List.of("ADMIN", "OWNER"))
                .claim("scope", "openid profile")
                .issueTime(Date.from(ISSUED_AT))
                .expirationTime(Date.from(expiresAt))
                .build();
    }

    private static String signedWithUnknownKey(JWTClaimsSet claims) {
        JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("unknown-key").build();
        SignedJWT jwt = new SignedJWT(header, claims);
        try {
            jwt.sign(new RSASSASigner(UNKNOWN_KEY));
        } catch (JOSEException e) {
            throw new IllegalStateException("Cannot sign the test token", e);
        }
        return jwt.serialize();
    }

    private static String unsigned(JWTClaimsSet claims) {
        return new PlainJWT(claims).serialize();
    }

    private static String encrypted(JWTClaimsSet claims) {
        EncryptedJWT jwt = new EncryptedJWT(new JWEHeader(JWEAlgorithm.RSA_OAEP_256, EncryptionMethod.A256GCM), claims);
        try {
            jwt.encrypt(new RSAEncrypter(UNKNOWN_KEY));
        } catch (JOSEException e) {
            throw new IllegalStateException("Cannot encrypt the test token", e);
        }
        return jwt.serialize();
    }

    private static String unsignedWithRawPayload(String payload) {
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        String header = encoder.encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
        return header + "." + encoder.encodeToString(payload.getBytes(StandardCharsets.UTF_8)) + ".";
    }

    private static RSAKey generateUnknownKey() {
        try {
            return new RSAKeyGenerator(2048).keyID("unknown-key").generate();
        } catch (JOSEException e) {
            throw new IllegalStateException("Cannot generate the unknown test key", e);
        }
    }
}
