package com.openframe.data.document.notification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
@CompoundIndexes({
        @CompoundIndex(name = "recipient_user_id", def = "{'recipient.userId': 1, '_id': -1}"),
        @CompoundIndex(name = "recipient_machine_id", def = "{'recipient.machineId': 1, '_id': -1}"),
        @CompoundIndex(name = "recipient_class_id", def = "{'recipient._class': 1, '_id': -1}")
})
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
