package com.openframe.data.document.notification;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notification_read_states")
@CompoundIndexes({
        @CompoundIndex(
                name = "recipient_notification_unique",
                def = "{'recipientId': 1, 'recipientType': 1, 'notificationId': 1}",
                unique = true),
        @CompoundIndex(
                name = "recipient_status",
                def = "{'recipientId': 1, 'recipientType': 1, 'status': 1}"),
        @CompoundIndex(
                name = "recipient_category_status",
                def = "{'recipientId': 1, 'recipientType': 1, 'category': 1, 'status': 1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationReadState implements TenantScoped {

    @Id
    private String id;

    private String recipientId;

    private RecipientType recipientType;

    private String notificationId;

    private ReadStatus status;

    private NotificationCategory category;

    private String title;

    private Instant readAt;

    private String tenantId;

}
