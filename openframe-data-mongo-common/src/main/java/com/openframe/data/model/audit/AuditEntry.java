package com.openframe.data.model.audit;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditOriginTool;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditTargetType;
import lombok.Builder;
import lombok.Getter;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.util.Assert;
import org.springframework.util.ClassUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TimeZone;

@Slf4j
@Getter
@ToString
@Builder(toBuilder = true)
public class AuditEntry {
    private final String id;
    private final AuditAction action;
    private final AuditOutcome outcome;
    private final String reason;
    private final AuditTargetType targetType;
    private final String targetId;
    private final String targetName;
    private final String targetTenantId;
    private final String tenantId;
    private final String organizationId;
    private final String deviceId;
    private final AuditOriginTool originTool;
    private final Map<String, Object> details;
    private final Map<String, AuditChange> changes;

    public AuditTargetType targetTypeOrDefault() {
        return Objects.requireNonNullElse(targetType, action.getTargetType());
    }

    public void requireOutcome() {
        Assert.state(outcome != null, "An audit entry needs an outcome");
    }

    public Map<String, Object> plainDetails() {
        if (details == null) {
            return null;
        }
        Map<String, Object> withValues = new LinkedHashMap<>();
        details.forEach((key, value) -> {
            if (hasNoValue(value)) {
                return;
            }
            Object plain = plainValueOrList(value);
            if (plain != null) {
                withValues.put(key, plain);
            } else {
                log.error("Audit detail {} of {} dropped: a {} is not a text, a number or a list of them",
                        key, action.getName(), value.getClass().getSimpleName());
            }
        });
        return withValues.isEmpty() ? null : withValues;
    }

    private static boolean hasNoValue(Object value) {
        return value == null || value instanceof Collection<?> values && values.stream().allMatch(Objects::isNull);
    }

    public static Object plainValue(Object value) {
        return switch (value) {
            case Integer _, Long _, Short _, Byte _, Double _, Float _, Boolean _ -> value;
            case Enum<?> constant -> constant.name();
            case ObjectId id -> id.toHexString();
            case Date date -> Instant.ofEpochMilli(date.getTime()).toString();
            case TimeZone zone -> zone.getID();
            case BigDecimal amount -> amount.toPlainString();
            default -> ClassUtils.isSimpleValueType(value.getClass()) ? value.toString() : null;
        };
    }

    private static Object plainValueOrList(Object value) {
        if (!(value instanceof Collection<?> values)) {
            return plainValue(value);
        }
        List<Object> plain = values.stream().filter(Objects::nonNull).map(AuditEntry::plainValue).toList();
        return plain.contains(null) ? null : plain;
    }
}
