package com.openframe.data.document.notification;

/**
 * Audience of a notification — drives query logic and NATS topic selection.
 *
 * <p>{@link #USER} is the default to keep deserialisation backward-compatible
 * with rows persisted before this enum existed.
 */
public enum RecipientScope {
    USER,
    MACHINE,
    ALL
}
