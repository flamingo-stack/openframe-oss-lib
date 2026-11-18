package com.openframe.data.service;

import com.openframe.data.model.audit.AuditActor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class AuditTenantResolver {

    private final TenantIdProvider tenantIdProvider;
    @Value("${openframe.security.jwt.super-tenant-id:}")
    private final String superTenantId;
    @Value("${openframe.tenant-isolation.enabled:false}")
    private final boolean tenantIsolated;

    public String superTenantId() {
        return superTenantId;
    }

    public String servedTenantId() {
        return tenantIsolated || !StringUtils.hasText(superTenantId) ? tenantIdProvider.getTenantId() : superTenantId;
    }

    public String isolatedTenantId() {
        return tenantIsolated ? tenantIdProvider.getTenantId() : null;
    }

    public String tenantFor(AuditActor actor, String requestedTenantId) {
        return actor.tenantFor(requestedTenantId, superTenantId, this::servedTenantId);
    }

    public boolean belongsToAnotherTenant(String recordTenantId, String eventTenantId) {
        return !tenantIsolated && recordTenantId != null && !recordTenantId.equals(eventTenantId)
                && !superTenantId.equals(eventTenantId);
    }
}
