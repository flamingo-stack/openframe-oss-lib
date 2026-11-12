package com.openframe.audit.targets;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditTargetType;
import lombok.With;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

@With
public record AuditTarget<T>(AuditTargetType type,
                             Class<T> documentType,
                             String idField,
                             Function<T, String> name,
                             Function<T, String> organizationId,
                             Function<T, String> deviceId,
                             Set<String> ignoredFields,
                             Set<String> maskedFields,
                             boolean secretId,
                             Map<String, AuditAction> enableActions,
                             Container<?, T> container) {

    public static final String TENANT_ID_FIELD = "tenantId";
    private static final String MONGO_ID_FIELD = "_id";
    private static final String ELEMENT_ID_FIELD = "id";

    public static <T> AuditTarget<T> of(AuditTargetType type, Class<T> documentType, Function<T, String> name) {
        return new AuditTarget<>(type, documentType, MONGO_ID_FIELD, name, _ -> null, _ -> null, Set.of(), Set.of(),
                false, Map.of(), null);
    }

    public static <T> AuditTarget<T> embedded(AuditTargetType type, Class<T> elementType, Container<?, T> container,
                                              Function<T, String> name) {
        return new AuditTarget<>(type, elementType, ELEMENT_ID_FIELD, name, _ -> null, _ -> null, Set.of(), Set.of(),
                false, Map.of(), container);
    }

    public boolean keyedByTenant() {
        return TENANT_ID_FIELD.equals(idField);
    }

    public String nameOf(Object document) {
        return name.apply(documentType.cast(document));
    }

    public String organizationIdOf(Object document) {
        return organizationId.apply(documentType.cast(document));
    }

    public String deviceIdOf(Object document) {
        return deviceId.apply(documentType.cast(document));
    }

    public record Container<C, T>(Class<C> type, String elementsField, Function<C, List<T>> elements, Function<T, String> elementId) {
    }
}
