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

    // Null on legacy-path and pre-migration documents; context stays authoritative until readers switch.
    private String type;

    private Map<String, String> attributes;

    private String applePushCategory;

    @CreatedDate
    @Indexed(expireAfterSeconds = NotificationRetention.HISTORY_TTL_SECONDS) // 30-day notifications-history retention
    private Instant createdAt;

    private NotificationContext context;

    private String tenantId;
}
