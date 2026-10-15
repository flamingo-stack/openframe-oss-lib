package com.openframe.api.controller;

import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MeControllerTest {

    private static final String SUPER_TENANT_ID = "1877e27c-b3fa-488f-82b6-449b80c1cc97";

    @Test
    void reportsSuperUserWhenTokenTenantIsTheSuperTenant() {
        assertThat(isSuperUser(new MeController(SUPER_TENANT_ID), SUPER_TENANT_ID)).isTrue();
    }

    @Test
    void reportsRegularUserForAnyOtherTenant() {
        assertThat(isSuperUser(new MeController(SUPER_TENANT_ID), "6f7639b7-f3a9-45d5-bb16-4b7c3c599a78")).isFalse();
    }

    @Test
    void reportsRegularUserWhenNoSuperTenantIsConfigured() {
        assertThat(isSuperUser(new MeController(""), SUPER_TENANT_ID)).isFalse();
    }

    @Test
    void returnsUnauthorizedWithoutPrincipal() {
        assertThat(new MeController(SUPER_TENANT_ID).getCurrentUser(null).getStatusCode().value()).isEqualTo(401);
    }

    @SuppressWarnings("unchecked")
    private static boolean isSuperUser(MeController controller, String tenantId) {
        AuthPrincipal principal = AuthPrincipal.builder()
                .id("user-1")
                .email("user@example.com")
                .roles(List.of("ADMIN"))
                .tenantId(tenantId)
                .build();

        ResponseEntity<?> response = controller.getCurrentUser(principal);
        Map<String, Object> user = (Map<String, Object>) ((Map<String, Object>) response.getBody()).get("user");
        return (boolean) user.get("isSuperUser");
    }
}
