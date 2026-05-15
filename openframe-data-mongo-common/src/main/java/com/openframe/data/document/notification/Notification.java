package com.openframe.data.document.notification;

import lombok.Builder;
import lombok.Value;
import lombok.With;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
@Value
@Builder
@With
public class Notification {

    @Id
    String id;

    @Builder.Default
    NotificationSeverity severity = NotificationSeverity.INFO;

    String title;

    String description;

    @CreatedDate
    Instant createdAt;

    NotificationContext context;
}
