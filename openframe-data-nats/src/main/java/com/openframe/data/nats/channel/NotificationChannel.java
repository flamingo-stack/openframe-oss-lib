package com.openframe.data.nats.channel;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;

/** An out-of-band delivery channel — push today, Slack next. The broadcaster fans out to every registered one. */
public interface NotificationChannel {

    /** Short id for logs, e.g. {@code "fcm"}. */
    String name();

    /** Best-effort: an unreachable recipient is a no-op, and a dead provider must never fail the notification. */
    void deliver(String userId, Notification notification, NotificationCategory category);
}
