package com.openframe.data.nats.model;

/**
 * Lifecycle of a notification as seen by clients on the NATS stream.
 * CREATED is the initial push; UPDATED supersedes an earlier push with the same notification id
 * (clients upsert by id rather than appending a new card).
 */
public enum NotificationEventType {
    CREATED,
    UPDATED
}
