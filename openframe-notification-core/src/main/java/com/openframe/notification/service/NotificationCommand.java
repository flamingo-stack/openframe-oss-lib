package com.openframe.notification.service;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.notification.spec.Audience;
import com.openframe.notification.spec.NotificationEntityRef;
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
    private final String correlationId;
    private final Audience audience;
    private final NotificationType type;
    private final Map<String, String> attributes;
    private final String applePushCategory;
    private final NotificationCategory category;
    private final NotificationSettingGroup settingsGroup;
    private final NotificationEntityRef entity;

    @Builder
    NotificationCommand(String title,
                        String description,
                        NotificationSeverity severity,
                        String correlationId,
                        Audience audience,
                        NotificationType type,
                        Map<String, String> attributes,
                        String applePushCategory,
                        NotificationCategory category,
                        NotificationSettingGroup settingsGroup,
                        NotificationEntityRef entity) {
        if (isBlank(title)) {
            throw new IllegalArgumentException("title must not be blank");
        }
        Objects.requireNonNull(severity, "severity must not be null");
        Objects.requireNonNull(audience, "audience must not be null");
        Objects.requireNonNull(type, "type must not be null");
        Objects.requireNonNull(attributes, "attributes must not be null");
        Objects.requireNonNull(category, "category must not be null");
        this.title = title;
        this.description = description;
        this.severity = severity;
        this.correlationId = correlationId;
        this.audience = audience;
        this.type = type;
        this.attributes = Map.copyOf(attributes);
        this.applePushCategory = applePushCategory;
        this.category = category;
        this.settingsGroup = settingsGroup;
        this.entity = entity;
    }
}
