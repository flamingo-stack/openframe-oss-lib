package com.openframe.data.document.ticket;

/**
 * Type of ticket owner (reporter).
 * CLIENT = end-user device (Fae), ADMIN = platform user (MSP admin), EMAIL = sender of an inbound email.
 * Separate from OwnerType for feature flag isolation.
 */
public enum TicketOwnerType {
    CLIENT,
    ADMIN,
    EMAIL
}
