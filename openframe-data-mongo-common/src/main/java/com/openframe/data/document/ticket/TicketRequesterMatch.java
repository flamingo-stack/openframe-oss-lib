package com.openframe.data.document.ticket;

/**
 * How the sender of an email ticket was tied to a directory account.
 * EMAIL = primary address, ALIAS = one of the account's other addresses, MANUAL = picked by a technician.
 */
public enum TicketRequesterMatch {
    EMAIL,
    ALIAS,
    MANUAL
}
