package com.openframe.api.controller;

import com.openframe.api.service.tenant.SuperUserResolver;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MeControllerTest {

    private static final String SUPER_TENANT_ID = "00000000-0000-0000-0000-000000000001";
    private static final String CUSTOMER_TENANT_ID = "00000000-0000-0000-0000-000000000002";

    @Test
    void reportsSuperUserWhenTokenTenantIsTheSuperTenant() {
        assertThat(isSuperUser(new MeController(new SuperUserResolver(SUPER_TENANT_ID)), SUPER_TENANT_ID)).isTrue();
    }

    @Test
    void reportsRegularUserForAnyOtherTenant() {
        assertThat(isSuperUser(new MeController(new SuperUserResolver(SUPER_TENANT_ID)), CUSTOMER_TENANT_ID)).isFalse();
    }

    @Test
    void reportsRegularUserWhenNoSuperTenantIsConfigured() {
        assertThat(isSuperUser(new MeController(new SuperUserResolver("")), SUPER_TENANT_ID)).isFalse();
    }

    @Test
    void returnsUnauthorizedWithoutPrincipal() {
        assertThat(new MeController(new SuperUserResolver(SUPER_TENANT_ID)).getCurrentUser(null).getStatusCode().value()).isEqualTo(401);
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
