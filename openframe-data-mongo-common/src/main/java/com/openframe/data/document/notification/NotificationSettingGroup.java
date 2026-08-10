package com.openframe.data.document.notification;

/**
 * The user-facing "Notify about" checkboxes. A group is a product label, not a context type — several
 * types can share one, and which group a notification belongs to is the descriptor's call
 * ({@link NotificationContextDescriptor#settingsGroup}). A type without a group cannot be muted.
 */
public enum NotificationSettingGroup {
    TICKET_ASSIGNED,
    TICKET_STATUS_CHANGED,
    CUSTOMER_REPLIED,
    ADMIN_REPLIED,
    MINGO_MESSAGES,
    APPROVAL_TICKET,
    APPROVAL_MINGO
}
