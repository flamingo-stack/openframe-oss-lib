package com.openframe.data.document.notification;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification implements TenantScoped {

    @Id
    private String id;

    @Builder.Default
    private NotificationSeverity severity = NotificationSeverity.INFO;

    private NotificationCategory category;

    private String title;

    private String description;

    @CreatedDate
    @Indexed(expireAfterSeconds = 2_592_000) // 30-day notifications-history retention
    private Instant createdAt;

    private NotificationContext context;

    /**
     * Optional source-event correlation key (e.g. an approval-request id) used to locate and
     * update a previously-pushed notification in place. Null for one-shot notifications.
     */
    @Indexed
    private String correlationId;

    private String tenantId;
}
