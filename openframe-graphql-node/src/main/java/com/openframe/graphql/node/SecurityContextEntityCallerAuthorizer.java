package com.openframe.graphql.node;

import com.openframe.security.authentication.AuthPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public class SecurityContextEntityCallerAuthorizer implements EntityCallerAuthorizer {

    // Gateway-only services trust the gateway: without a JWT the loaders get the null that @AuthenticationPrincipal gives.
    @Override
    public AuthPrincipal authorizeCaller() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken token) {
            Jwt jwt = token.getToken();
            return AuthPrincipal.fromJwt(jwt);
        }
        return null;
    }
}
