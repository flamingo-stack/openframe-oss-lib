package com.openframe.data.document.ticket;

/**
 * Type of ticket owner (reporter).
 * CLIENT = end-user device (AI assistant), ADMIN = platform user (MSP admin).
 * Separate from OwnerType for feature flag isolation.
 */
public enum TicketOwnerType {
    CLIENT,
    ADMIN
}
