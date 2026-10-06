package com.openframe.data.nats.model;

/**
 * Lifecycle of a notification as seen by clients on the NATS stream.
 * CREATED is the initial push; UPDATED supersedes an earlier push with the same notification id
 * (clients upsert by id rather than appending a new card). READ, ARCHIVED and DELETED carry no
 * content — only ids — and tell other tabs/devices the recipient's read-state changed elsewhere;
 * ARCHIVED is the auto-read that happens when the notification's ticket or dialog is archived.
 */
public enum NotificationEventType {
    CREATED,
    UPDATED,
    READ,
    ARCHIVED,
    DELETED
}
