package com.openframe.data.nats.model;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSeverity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationMessage {

    private String id;
    private NotificationSeverity severity;
    private String title;
    private String description;
    private Instant createdAt;
    private NotificationCategory category;
    private NotificationEventType eventType;
    private String type;
    private Map<String, String> attributes;

    private List<String> notificationIds;
}
