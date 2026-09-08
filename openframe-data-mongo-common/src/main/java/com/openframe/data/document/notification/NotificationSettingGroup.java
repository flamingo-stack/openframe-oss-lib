package com.openframe.data.document.notification;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** The "Notify about" checkboxes; membership is the descriptor's call and several types can share one group. */
@Getter
@AllArgsConstructor
public enum NotificationSettingGroup {
    TICKET_ASSIGNED("Ticket assigned"),
    TICKET_CREATED("Ticket created"),
    TICKET_STATUS_CHANGED("Ticket status changed"),
    CUSTOMER_REPLIED("Customer replied"),
    ADMIN_REPLIED("Admin replied"),
    MINGO_MESSAGES("New messages from Mingo"),
    APPROVAL_TICKET("Approval required ticket"),
    APPROVAL_MINGO("Approval required Mingo");

    private final String label;
}
