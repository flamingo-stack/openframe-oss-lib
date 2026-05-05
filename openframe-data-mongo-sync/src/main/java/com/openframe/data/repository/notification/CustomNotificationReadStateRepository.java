package com.openframe.data.repository.notification;

import java.util.Collection;
import java.util.Set;

public interface CustomNotificationReadStateRepository {

    /** Idempotent upsert. Returns {@code true} only on the unread→read transition. */
    boolean markRead(String userId, String notificationId);

    /** Subset of {@code notificationIds} the user has marked read — bulk lookup, no N+1. */
    Set<String> findReadIds(String userId, Collection<String> notificationIds);
}
