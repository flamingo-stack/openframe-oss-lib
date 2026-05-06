package com.openframe.data.document.notification;

import com.openframe.data.document.clientconfiguration.PublishState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
@CompoundIndexes({
        @CompoundIndex(name = "recipient_user_id", def = "{'recipientUserId': 1, '_id': -1}"),
        @CompoundIndex(name = "recipient_machine_id", def = "{'recipientMachineId': 1, '_id': -1}"),
        // Broadcasts (scope=ALL) are joined via $or for every user/machine list query;
        // a separate compound on scope keeps that slice cheap.
        @CompoundIndex(name = "recipient_scope_id", def = "{'recipientScope': 1, '_id': -1}"),
        @CompoundIndex(name = "publish_state", def = "{'publishState.published': 1, 'publishState.attempts': 1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    private String id;

    /** Defaults to USER so rows persisted before this enum existed deserialise correctly. */
    @Builder.Default
    private RecipientScope recipientScope = RecipientScope.USER;

    private String recipientUserId;

    private String recipientMachineId;

    @Builder.Default
    private NotificationSeverity severity = NotificationSeverity.INFO;

    private String title;

    @CreatedDate
    private Instant createdAt;

    private NotificationContext context;

    /**
     * Always populated so the retry-candidates index hits without an {@code $exists:false}
     * branch — the planner falls back to a full {@code _id} walk when the field is optional.
     */
    @Builder.Default
    private PublishState publishState = PublishState.builder()
            .published(false)
            .attempts(0)
            .build();

    /** Per-user view-state, populated at query time. Not persisted, not on the wire. */
    @Transient
    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    private boolean read;
}
