package com.openframe.data.document.notification;

/**
 * UI-presentation severity. Independent of {@code type} — the same notification
 * type can vary in severity based on context.
 */
public enum NotificationSeverity {
    INFO,
    WARNING,
    DANGER
}
