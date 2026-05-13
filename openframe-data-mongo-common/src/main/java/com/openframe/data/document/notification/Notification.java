package com.openframe.data.document.notification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    private String id;

    private Recipient recipient;

    @Builder.Default
    private NotificationSeverity severity = NotificationSeverity.INFO;

    private String title;

    @CreatedDate
    private Instant createdAt;

    private NotificationContext context;
}
