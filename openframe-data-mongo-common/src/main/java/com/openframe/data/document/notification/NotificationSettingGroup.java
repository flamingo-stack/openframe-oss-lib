package com.openframe.data.document.notification;

/** The "Notify about" checkboxes; membership is the descriptor's call and several types can share one group. */
public enum NotificationSettingGroup {
    TICKET_ASSIGNED,
    TICKET_STATUS_CHANGED,
    CUSTOMER_REPLIED,
    ADMIN_REPLIED,
    MINGO_MESSAGES,
    APPROVAL_TICKET,
    APPROVAL_MINGO
}
