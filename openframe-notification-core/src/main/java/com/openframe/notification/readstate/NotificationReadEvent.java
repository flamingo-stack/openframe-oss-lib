package com.openframe.notification.readstate;

import com.openframe.data.document.notification.RecipientType;

import java.util.List;

/**
 * One recipient's read-state transition, emitted after the change is persisted. Bulk operations
 * (markAllAsRead, deleteAllRead) arrive as ONE event carrying every affected notification id.
 */
public record NotificationReadEvent(String recipientId,
                                    RecipientType recipientType,
                                    List<String> notificationIds,
                                    Transition transition) {

    public enum Transition {READ, DELETED}
}
