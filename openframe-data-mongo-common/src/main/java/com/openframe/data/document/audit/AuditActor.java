package com.openframe.data.document.audit;

import java.util.List;

import static com.openframe.data.document.audit.AuditActorType.DEVICE;
import static com.openframe.data.document.audit.AuditActorType.STAFF;
import static com.openframe.data.document.audit.AuditActorType.SYSTEM;
import static com.openframe.data.document.audit.AuditActorType.USER;

public record AuditActor(AuditActorType type, String id, String email, List<String> roles, String tokenTenantId) {

    private static final String AGENT_ROLE = "AGENT";

    public static AuditActor system() {
        return new AuditActor(SYSTEM, null, null, List.of(), null);
    }

    public static AuditActor fromToken(List<String> roles, String userId, String email, String tenantId,
                                       String machineId, String superTenantId) {
        if (roles.contains(AGENT_ROLE)) {
            return new AuditActor(DEVICE, machineId, null, roles, tenantId);
        }
        AuditActorType type = superTenantId.equals(tenantId) ? STAFF : USER;
        return new AuditActor(type, userId, email, roles, tenantId);
    }

    public boolean isPerson() {
        return type == USER || type == STAFF;
    }
}
