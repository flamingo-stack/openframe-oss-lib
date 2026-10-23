package com.openframe.api.service.tenant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import static org.assertj.core.api.Assertions.assertThat;

class SuperUserResolverTest {

    private static final String SUPER_TENANT_ID = "1877e27c-b3fa-488f-82b6-449b80c1cc97";
    private static final String CUSTOMER_TENANT_ID = "6f7639b7-f3a9-45d5-bb16-4b7c3c599a78";

    private final SuperUserResolver resolver = new SuperUserResolver(SUPER_TENANT_ID);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("isCurrentUserSuperUser: a caller whose token belongs to the super tenant is a super user")
    void currentCallerOfTheSuperTenant_isSuperUser() {
        authenticate(SUPER_TENANT_ID);

        assertThat(resolver.isCurrentUserSuperUser()).isTrue();
    }

    @Test
    @DisplayName("isCurrentUserSuperUser: a caller of any other tenant is not")
    void currentCallerOfAnotherTenant_isNotSuperUser() {
        authenticate(CUSTOMER_TENANT_ID);

        assertThat(resolver.isCurrentUserSuperUser()).isFalse();
    }

    @Test
    @DisplayName("isCurrentUserSuperUser: no caller at all — a scheduler or async run — is not a super user")
    void noCaller_isNotSuperUser() {
        assertThat(resolver.isCurrentUserSuperUser()).isFalse();
    }

    @Test
    @DisplayName("isCurrentUserSuperUser: with no super tenant configured nobody is a super user")
    void noSuperTenantConfigured_nobodyIsSuperUser() {
        authenticate(SUPER_TENANT_ID);

        assertThat(new SuperUserResolver("").isCurrentUserSuperUser()).isFalse();
    }

    private static void authenticate(String tenantId) {
        Jwt jwt = Jwt.withTokenValue("t").header("alg", "none")
                .subject("user-1")
                .claim("tenant_id", tenantId)
                .build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(jwt, null));
    }
}
