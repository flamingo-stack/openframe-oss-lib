package com.openframe.security.authentication;

import com.openframe.core.exception.ErrorCode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class AccessDeniedErrorCodeTest {

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void forCurrentCaller_signedInCaller_returnsForbidden() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", "user-1")
                .claim("roles", List.of("ADMIN"))
                .build();
        SecurityContextHolder.getContext()
                .setAuthentication(new JwtAuthenticationToken(jwt, AuthorityUtils.createAuthorityList("ADMIN")));

        ErrorCode code = AccessDeniedErrorCode.forCurrentCaller();

        assertThat(code).isEqualTo(ErrorCode.FORBIDDEN);
    }

    @ParameterizedTest
    @MethodSource("callersWithoutIdentity")
    void forCurrentCaller_callerWithoutIdentity_returnsUnauthorized(Authentication authentication) {
        SecurityContextHolder.getContext().setAuthentication(authentication);

        ErrorCode code = AccessDeniedErrorCode.forCurrentCaller();

        assertThat(code).isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    private static Stream<Arguments> callersWithoutIdentity() {
        return Stream.of(
                arguments(Named.of("no authentication", null)),
                arguments(Named.of("anonymous visitor", new AnonymousAuthenticationToken("key", "anonymousUser",
                        AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")))),
                arguments(Named.of("not yet authenticated",
                        UsernamePasswordAuthenticationToken.unauthenticated("user-1", "secret"))));
    }
}
