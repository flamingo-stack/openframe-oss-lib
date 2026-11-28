package com.openframe.gateway.security.revocation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class RevokedKeyValidatorTest {

    private static final String REVOKED_KID = "kid-revoked";
    private static final String CURRENT_KID = "kid-current";

    private RevokedKeyRegistry registry;
    private RevokedKeyValidator validator;

    @BeforeEach
    void setUp() {
        registry = new RevokedKeyRegistry(Duration.ofHours(1));
        validator = new RevokedKeyValidator(registry);
    }

    @Test
    void tokenWithRevokedKidIsRejected() {
        // setup
        registry.revoke(REVOKED_KID);
        Jwt jwt = jwtWithKid(REVOKED_KID);

        // execution
        OAuth2TokenValidatorResult result = validator.validate(jwt);

        // verifications
        assertThat(result.hasErrors()).isTrue();
        assertThat(result.getErrors())
                .extracting(OAuth2Error::getErrorCode, OAuth2Error::getDescription)
                .containsExactly(tuple("invalid_token", "revoked signing key"));
    }

    @Test
    void tokenWithCurrentKidPasses() {
        // setup
        registry.revoke(REVOKED_KID);
        Jwt jwt = jwtWithKid(CURRENT_KID);

        // execution
        OAuth2TokenValidatorResult result = validator.validate(jwt);

        // verifications
        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    void emptyRegistryNeverRejects() {
        // setup
        Jwt withKid = jwtWithKid(REVOKED_KID);
        Jwt withoutKid = Jwt.withTokenValue("token").header("alg", "RS256").claim("sub", "user").build();

        // execution
        OAuth2TokenValidatorResult withKidResult = validator.validate(withKid);
        OAuth2TokenValidatorResult withoutKidResult = validator.validate(withoutKid);

        // verifications
        assertThat(withKidResult.hasErrors()).isFalse();
        assertThat(withoutKidResult.hasErrors()).isFalse();
    }

    private static Jwt jwtWithKid(String kid) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .header("kid", kid)
                .claim("sub", "user")
                .build();
    }
}
