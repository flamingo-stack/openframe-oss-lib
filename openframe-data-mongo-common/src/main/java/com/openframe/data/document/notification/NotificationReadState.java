package com.openframe.data.document.notification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Per-user read state. Lives in its own collection so a write by one user
 * cannot affect another, and so the same notification document can be addressed
 * to multiple users without contention on a shared list field.
 */
@Document(collection = "notification_read_states")
@CompoundIndexes({
        @CompoundIndex(
                name = "user_notification_unique",
                def = "{'userId': 1, 'notificationId': 1}",
                unique = true),
        @CompoundIndex(
                name = "user_read_at",
                def = "{'userId': 1, 'readAt': -1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationReadState {

    @Id
    private String id;

    private String userId;

    private String notificationId;

    private Instant readAt;
}
