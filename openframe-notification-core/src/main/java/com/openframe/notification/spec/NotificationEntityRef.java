package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationEntityType;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * The entity a notification is about — the one its own click-through opens. Unread counts and the
 * "mark everything on this entity as read" mutation are grouped by it.
 */
public record NotificationEntityRef(NotificationEntityType type, String id) {

    public NotificationEntityRef {
        if (type == null) {
            throw new IllegalArgumentException("entity type must not be null");
        }
        if (isBlank(id)) {
            throw new IllegalArgumentException("entity id must not be blank");
        }
    }

    public static NotificationEntityRef ticket(String ticketId) {
        return new NotificationEntityRef(NotificationEntityType.TICKET, ticketId);
    }

    public static NotificationEntityRef dialog(String dialogId) {
        return new NotificationEntityRef(NotificationEntityType.DIALOG, dialogId);
    }
}
