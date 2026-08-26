package com.openframe.notification.service;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.notification.spec.Audience;
import com.openframe.notification.spec.NotificationType;
import lombok.Builder;
import lombok.Getter;

import java.util.Map;
import java.util.Objects;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Getter
public final class NotificationCommand {

    private final String title;
    private final String description;
    private final NotificationSeverity severity;
    private final NotificationContext context;
    private final String correlationId;
    private final Audience audience;
    // Null until the caller is the spec-driven emitter; legacy dispatchers don't set them.
    private final NotificationType type;
    private final Map<String, String> attributes;
    private final String pushCategory;

    @Builder
    NotificationCommand(String title,
                        String description,
                        NotificationSeverity severity,
                        NotificationContext context,
                        String correlationId,
                        Audience audience,
                        NotificationType type,
                        Map<String, String> attributes,
                        String pushCategory) {
        if (isBlank(title)) {
            throw new IllegalArgumentException("title must not be blank");
        }
        Objects.requireNonNull(severity, "severity must not be null");
        Objects.requireNonNull(context, "context must not be null");
        Objects.requireNonNull(audience, "audience must not be null");
        if (isBlank(context.getType())) {
            throw new IllegalArgumentException("context.type must not be blank");
        }
        this.title = title;
        this.description = description;
        this.severity = severity;
        this.context = context;
        this.correlationId = correlationId;
        this.audience = audience;
        this.type = type;
        this.attributes = attributes == null ? null : Map.copyOf(attributes);
        this.pushCategory = pushCategory;
    }
}
