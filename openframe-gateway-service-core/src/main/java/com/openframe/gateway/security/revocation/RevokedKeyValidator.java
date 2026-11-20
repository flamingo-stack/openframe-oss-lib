package com.openframe.gateway.security.revocation;

import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/** Rejects a token signed with a key that was revoked after the issuer's JWKS was cached. */
@RequiredArgsConstructor
public class RevokedKeyValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error REVOKED =
            new OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN, "revoked signing key", null);

    private final RevokedKeyRegistry registry;

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        Object kid = jwt.getHeaders().get("kid");
        return kid instanceof String id && registry.isRevoked(id)
                ? OAuth2TokenValidatorResult.failure(REVOKED)
                : OAuth2TokenValidatorResult.success();
    }
}
