package com.openframe.data.document.notification;

/**
 * Shared retention constants for the notifications domain.
 */
public final class NotificationRetention {

    /**
     * TTL for notifications history and their read-states: 30 days, expressed in seconds.
     * Used as the {@code expireAfterSeconds} of the Mongo TTL index on {@code createdAt}.
     */
    public static final int HISTORY_TTL_SECONDS = 2_592_000; // 30 days

    private NotificationRetention() {
    }
}
