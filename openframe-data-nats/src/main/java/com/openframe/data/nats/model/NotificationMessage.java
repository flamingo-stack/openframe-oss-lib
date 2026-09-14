package com.openframe.data.nats.model;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSeverity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationMessage {

    private String id;
    private NotificationSeverity severity;
    private String title;
    private String description;
    private Instant createdAt;
    private NotificationCategory category;
    private NotificationEventType eventType;
    private String type;
    private Map<String, String> attributes;
    // Wire-only shim, never stored: the deployed web client throws inside its Relay updater on a
    // CREATED push that carries no `context` key at all (it calls setLinkedRecord(null)), and the
    // failed updater then poisons every later store commit until reload. Drop once the client stops
    // reading `context` off the payload.
    private Map<String, String> context;

    private List<String> notificationIds;
}
