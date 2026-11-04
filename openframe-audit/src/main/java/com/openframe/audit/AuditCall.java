package com.openframe.audit;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditTargetType;

import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;

public record AuditCall(AuditAction action,
                        AuditTargetType targetType,
                        Supplier<String> targetIdBeforeCall,
                        Function<Object, String> targetIdFromResult,
                        boolean targetIdInResult,
                        Function<Object, Map<String, Object>> detailsFromResult,
                        boolean compare,
                        Predicate<Object> recordsResult,
                        Function<Object, String> tenantIdOf) {

    public static AuditCall of(AuditAction action, String targetId) {
        return of(action, targetId, Map.of());
    }

    public static AuditCall of(AuditAction action, String targetId, Map<String, Object> details) {
        return of(action, action.getTargetType(), targetId, details);
    }

    public static AuditCall of(AuditAction action, AuditTargetType targetType, String targetId,
                               Map<String, Object> details) {
        return new AuditCall(action, targetType, () -> targetId, _ -> null, false, _ -> details, true, _ -> true,
                _ -> null);
    }
}
