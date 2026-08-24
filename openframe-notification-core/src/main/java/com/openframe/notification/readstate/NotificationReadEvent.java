package com.openframe.notification.readstate;

import com.openframe.data.document.notification.RecipientType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * One recipient's read-state transition, emitted after the change is persisted. Bulk operations
 * (markAllAsRead, deleteAllRead) arrive as ONE event carrying every affected notification id.
 */
@Getter
@AllArgsConstructor
@Builder
public class NotificationReadEvent {
    private final String recipientId;
    private final RecipientType recipientType;
    private final List<String> notificationIds;
    private final Transition transition;

    public enum Transition {READ, DELETED}
}
