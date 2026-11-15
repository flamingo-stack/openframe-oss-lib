package com.openframe.data.model.audit;

import com.openframe.data.document.audit.AuditActorType;
import lombok.With;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

import static com.openframe.data.document.audit.AuditActorType.API_KEY;
import static com.openframe.data.document.audit.AuditActorType.DEVICE;
import static com.openframe.data.document.audit.AuditActorType.FAE;
import static com.openframe.data.document.audit.AuditActorType.MINGO;
import static com.openframe.data.document.audit.AuditActorType.STAFF;
import static com.openframe.data.document.audit.AuditActorType.SYSTEM;
import static com.openframe.data.document.audit.AuditActorType.USER;

public record AuditActor(AuditActorType type, String id, String name, String email, List<String> roles,
                         String tokenTenantId, String onBehalfOfId, @With AuditActor approver) {

    public static AuditActor system() {
        return new AuditActor(SYSTEM, null, null, null, List.of(), null, null, null);
    }

    public static AuditActor system(String name) {
        return system(name, null);
    }

    public static AuditActor system(String name, String onBehalfOfId) {
        return new AuditActor(SYSTEM, name, name, null, List.of(), null, onBehalfOfId, null);
    }

    public static AuditActor staff(String id) {
        return new AuditActor(STAFF, id, null, null, List.of(), null, null, null);
    }

    public static AuditActor fromUser(String userId, String email, List<String> roles, String tenantId,
                                      String superTenantId) {
        AuditActorType type = superTenantId.equals(tenantId) ? STAFF : USER;
        return new AuditActor(type, userId, null, email, roles, tenantId, null, null);
    }

    public static AuditActor fromAgent(String machineId, List<String> roles, String tenantId) {
        return new AuditActor(DEVICE, machineId, null, null, roles, tenantId, null, null);
    }

    public static AuditActor mingo(String senderUserId) {
        return new AuditActor(MINGO, null, "Mingo", null, List.of(), null, senderUserId, null);
    }

    public static AuditActor fae(String machineId) {
        return new AuditActor(FAE, null, "Fae", null, List.of(), null, machineId, null);
    }

    public static AuditActor fromApiKey(String keyId, String keyName, List<String> keyRoles, String keyTenantId,
                                        String ownerId) {
        return new AuditActor(API_KEY, keyId, keyName, null, Objects.requireNonNullElse(keyRoles, List.of()),
                keyTenantId, ownerId, null);
    }

    public String tenantFor(String requestedTenantId, String superTenantId, Supplier<String> servedTenantId) {
        if (StringUtils.hasText(requestedTenantId)) {
            return requestedTenantId;
        }
        if (StringUtils.hasText(tokenTenantId) && !tokenTenantId.equals(superTenantId)) {
            return tokenTenantId;
        }
        return servedTenantId.get();
    }
}
