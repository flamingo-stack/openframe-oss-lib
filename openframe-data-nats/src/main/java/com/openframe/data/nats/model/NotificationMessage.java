package com.openframe.data.nats.model;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.document.notification.RecipientScope;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Wire payload for NATS-delivered notifications. Subscribers must register the
 * concrete {@link NotificationContext} subtypes they expect on their
 * {@link com.fasterxml.jackson.databind.ObjectMapper} (the {@code SimpleModule}
 * built from {@code NotificationContextBinding} beans handles this in-app).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationMessage {

    private String id;
    private RecipientScope recipientScope;
    private String recipientUserId;
    private String recipientMachineId;
    private NotificationSeverity severity;
    private String title;
    private Instant createdAt;
    private NotificationContext context;
}
