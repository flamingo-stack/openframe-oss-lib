package com.openframe.data.document.notification;

import com.openframe.data.document.TenantScoped;
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
public class Notification implements TenantScoped {

    @Id
    private String id;

    @Builder.Default
    private NotificationSeverity severity = NotificationSeverity.INFO;

    private String title;

    private String description;

    @CreatedDate
    private Instant createdAt;

    private NotificationContext context;

    private String tenantId;
}
