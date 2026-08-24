package com.openframe.api.dto.notification;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSeverity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationView {
    private String id;
    private NotificationSeverity severity;
    private String title;
    private String description;
    private Instant createdAt;
    private NotificationCategory category;
    private NotificationContext context;
    private String type;
    private Map<String, String> attributes;
    private boolean read;
}
