package com.openframe.data.document.notification;

/**
 * Kind of the entity a notification is about. Stored next to the id so a read-state row says what it
 * points at without joining back to the notification, and so the id spaces of two kinds are never
 * assumed to be disjoint — device ids, for one, are not ObjectIds.
 */
public enum NotificationEntityType {
    TICKET,
    DIALOG
}
