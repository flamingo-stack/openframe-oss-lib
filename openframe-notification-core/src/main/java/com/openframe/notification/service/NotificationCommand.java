package com.openframe.notification.service;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.notification.spec.NotificationType;
import com.openframe.data.document.notification.NotificationSeverity;
import lombok.Builder;
import lombok.Getter;

import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Getter
public final class NotificationCommand {

    private final String title;
    private final String description;
    private final NotificationSeverity severity;
    private final NotificationContext context;
    private final String correlationId;
    private final Set<String> adminAudience;
    private final Set<String> machineAudience;
    // Null until the caller is the spec-driven emitter; legacy dispatchers don't set them.
    private final NotificationType type;
    private final Map<String, String> attributes;

    @Builder
    NotificationCommand(String title,
                        String description,
                        NotificationSeverity severity,
                        NotificationContext context,
                        String correlationId,
                        Set<String> adminAudience,
                        Set<String> machineAudience,
                        NotificationType type,
                        Map<String, String> attributes) {
        if (isBlank(title)) {
            throw new IllegalArgumentException("title must not be blank");
        }
        Objects.requireNonNull(severity, "severity must not be null");
        Objects.requireNonNull(context, "context must not be null");
        if (isBlank(context.getType())) {
            throw new IllegalArgumentException("context.type must not be blank");
        }
        Set<String> admins = sanitizeAudience(adminAudience, "adminAudience");
        Set<String> machines = sanitizeAudience(machineAudience, "machineAudience");
        if (admins.isEmpty() && machines.isEmpty()) {
            throw new IllegalArgumentException("at least one of adminAudience or machineAudience must be non-empty");
        }
        this.title = title;
        this.description = description;
        this.severity = severity;
        this.context = context;
        this.correlationId = correlationId;
        this.adminAudience = admins;
        this.machineAudience = machines;
        this.type = type;
        this.attributes = attributes == null ? null : Map.copyOf(attributes);
    }

    private static Set<String> sanitizeAudience(Set<String> audience, String fieldName) {
        if (audience == null) {
            return Set.of();
        }
        for (String entry : audience) {
            if (isBlank(entry)) {
                throw new IllegalArgumentException(fieldName + " must not contain blank entries");
            }
        }
        return Set.copyOf(audience);
    }
}
