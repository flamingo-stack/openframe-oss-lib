package com.openframe.api.controller;

import com.openframe.security.authentication.AuthPrincipal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
public class MeController {

    /**
     * Tenant whose users may act across every tenant. Blank (the default) means no super tenant,
     * so nobody is reported as a super user.
     */
    private final String superTenantId;

    public MeController(@Value("${openframe.security.jwt.super-tenant-id:}") String superTenantId) {
        this.superTenantId = superTenantId;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal AuthPrincipal principal) {
        if (principal == null) {
            log.warn("No authenticated principal found");
            return ResponseEntity.status(401).body(Map.of(
                    "error", "unauthorized",
                    "error_description", "No authenticated user found"
            ));
        }

        log.debug("Getting current user info for: {}", principal.getId());

        return ResponseEntity.ok(Map.of(
                "authenticated", true,
                "user", Map.of(
                        "id", principal.getId(),
                        "email", principal.getEmail(),
                        "displayName", principal.getDisplayName(),
                        "roles", principal.getRoles(),
                        "tenantId", principal.getTenantId(),
                        "isSuperUser", isSuperTenant(principal.getTenantId())
                )
        ));
    }

    private boolean isSuperTenant(String tenantId) {
        return !superTenantId.isBlank() && superTenantId.equals(tenantId);
    }
}
