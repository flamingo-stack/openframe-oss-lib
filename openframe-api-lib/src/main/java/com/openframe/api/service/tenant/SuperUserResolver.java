package com.openframe.api.service.tenant;

import com.openframe.security.authentication.AuthPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class SuperUserResolver {

    private final String superTenantId;

    public SuperUserResolver(@Value("${openframe.security.jwt.super-tenant-id:}") String superTenantId) {
        this.superTenantId = superTenantId;
    }

    public boolean isSuperUser(AuthPrincipal principal) {
        return principal != null && !superTenantId.isBlank() && superTenantId.equals(principal.getTenantId());
    }

    public boolean isCurrentUserSuperUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            return false;
        }
        return isSuperUser(AuthPrincipal.fromJwt(jwt));
    }
}
