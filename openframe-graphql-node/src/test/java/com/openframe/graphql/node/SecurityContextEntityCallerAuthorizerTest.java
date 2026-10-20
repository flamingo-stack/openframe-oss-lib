package com.openframe.graphql.node;

import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityContextEntityCallerAuthorizerTest {

    private final SecurityContextEntityCallerAuthorizer authorizer = new SecurityContextEntityCallerAuthorizer();

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authorizeCaller_jwtCaller_principalFromTheToken() {
        // setup
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("user-1")
                .claim("tenant_id", "tenant-1")
                .claim("roles", List.of("ADMIN"))
                .build();
        JwtAuthenticationToken token = new JwtAuthenticationToken(jwt);
        SecurityContextHolder.getContext().setAuthentication(token);
        AuthPrincipal expected = AuthPrincipal.fromJwt(jwt);

        // execution
        AuthPrincipal principal = authorizer.authorizeCaller();

        // verifications
        assertThat(principal).isEqualTo(expected);
    }

    @Test
    void authorizeCaller_noAuthentication_null() {
        // execution
        AuthPrincipal principal = authorizer.authorizeCaller();

        // verifications
        assertThat(principal).isNull();
    }

    @Test
    void authorizeCaller_nonJwtAuthentication_null() {
        // setup
        List<GrantedAuthority> authorities = List.of();
        UsernamePasswordAuthenticationToken token =
                UsernamePasswordAuthenticationToken.authenticated("user-1", "secret", authorities);
        SecurityContextHolder.getContext().setAuthentication(token);

        // execution
        AuthPrincipal principal = authorizer.authorizeCaller();

        // verifications
        assertThat(principal).isNull();
    }
}
