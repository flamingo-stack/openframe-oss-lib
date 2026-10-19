package com.openframe.data.nats.model;

// Lifecycle of a notification on the NATS stream: CREATED is the initial push, UPDATED upserts by id, READ/ARCHIVED/DELETED carry only ids and tell other tabs the read-state changed elsewhere (ARCHIVED = auto-read when the ticket/dialog is archived).
public enum NotificationEventType {
    CREATED,
    UPDATED,
    READ,
    ARCHIVED,
    DELETED
}
