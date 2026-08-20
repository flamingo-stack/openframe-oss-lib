package com.openframe.api.dto.notification;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSeverity;
import lombok.Builder;

import java.time.Instant;
import java.util.Map;

@Builder
public record NotificationView(String id, NotificationSeverity severity, String title, String description,
                               Instant createdAt, NotificationCategory category, NotificationContext context,
                               String type, Map<String, String> attributes,
                               boolean read)     {}
