package com.openframe.data.nats.model;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSeverity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

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
    private NotificationContext context;
    private NotificationEventType eventType;
}
