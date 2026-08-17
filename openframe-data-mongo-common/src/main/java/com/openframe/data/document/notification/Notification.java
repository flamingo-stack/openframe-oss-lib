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
import java.util.Map;

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

    /**
     * Spec-driven notification type and its flat fact snapshot. Null on documents written by the
     * legacy dispatcher path and on pre-migration history; the typed {@link #context} stays the
     * source of truth until every reader has switched to these two fields.
     */
    private String type;

    private Map<String, String> attributes;

    @CreatedDate
    @Indexed(expireAfterSeconds = NotificationRetention.HISTORY_TTL_SECONDS) // 30-day notifications-history retention
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
