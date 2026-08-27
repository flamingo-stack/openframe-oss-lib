package com.openframe.data.document.notification;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
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
                def = "{'recipientId': 1, 'recipientType': 1, 'category': 1, 'status': 1}"),
        // Equality fields first, entityId last as the grouping key, so the unread-per-entity
        // aggregation is answered from the index alone. A new name, never an edit of the one above:
        // changing a live @CompoundIndex def fails startup with IndexOptionsConflict.
        @CompoundIndex(
                name = "tenant_recipient_entity_status",
                def = "{'tenantId': 1, 'recipientId': 1, 'recipientType': 1, 'entityType': 1, 'status': 1, 'entityId': 1}")
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

    /**
     * The entity this notification is about, copied here for the same reason category is: unread is
     * per recipient, so grouping has to run over these rows. Null on rows written before the field
     * existed and on notifications about no entity — both simply produce no badge.
     */
    private NotificationEntityType entityType;

    private String entityId;

    private String title;

    @CreatedDate
    @Indexed(expireAfterSeconds = NotificationRetention.HISTORY_TTL_SECONDS) // 30-day retention, mirrors Notification
    private Instant createdAt;

    private Instant readAt;

    private String tenantId;

}
