package com.openframe.test.data.dto.ai;

/**
 * Who authored a message. The terminal run marker is an {@link #ASSISTANT} message carrying a TEXT
 * data entry (see {@code RunWaiter}).
 */
public enum MessageOwnerType {
    CLIENT,
    ASSISTANT,
    ADMIN,
    SYSTEM
}
