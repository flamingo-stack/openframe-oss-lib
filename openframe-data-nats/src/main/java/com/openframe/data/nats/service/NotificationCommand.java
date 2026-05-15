package com.openframe.data.nats.service;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSeverity;
import lombok.Builder;
import lombok.Getter;

import java.util.Objects;
import java.util.Set;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Getter
public final class NotificationCommand {

    private final String title;
    private final String description;
    private final NotificationSeverity severity;
    private final NotificationContext context;
    private final Set<String> adminAudience;
    private final Set<String> machineAudience;

    @Builder
    NotificationCommand(String title,
                        String description,
                        NotificationSeverity severity,
                        NotificationContext context,
                        Set<String> adminAudience,
                        Set<String> machineAudience) {
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
        this.adminAudience = admins;
        this.machineAudience = machines;
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
