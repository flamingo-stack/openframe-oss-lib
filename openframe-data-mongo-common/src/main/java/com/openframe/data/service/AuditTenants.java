package com.openframe.data.service;

import com.openframe.data.document.audit.AuditActor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class AuditTenants {

    private final TenantIdProvider tenantIdProvider;
    @Value("${openframe.security.jwt.super-tenant-id:}")
    private final String superTenantId;
    @Value("${openframe.tenant-isolation.enabled:false}")
    private final boolean servesOneTenant;

    public String superTenantId() {
        return superTenantId;
    }

    public String servedTenantId() {
        return servesOneTenant || !StringUtils.hasText(superTenantId) ? tenantIdProvider.getTenantId() : superTenantId;
    }

    public String isolatedTenantId() {
        return servesOneTenant ? tenantIdProvider.getTenantId() : null;
    }

    public String tenantFor(AuditActor actor, String requestedTenantId) {
        return actor.tenantFor(requestedTenantId, superTenantId, this::servedTenantId);
    }
}
