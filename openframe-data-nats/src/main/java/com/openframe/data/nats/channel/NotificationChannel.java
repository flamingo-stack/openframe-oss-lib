package com.openframe.data.nats.channel;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;

/**
 * An out-of-band delivery channel — OS push today, Slack next. The broadcaster fans out to every
 * registered channel, so adding one is a new bean in its own opt-in module and nothing here changes.
 */
public interface NotificationChannel {

    /** Short id for logs, e.g. {@code "fcm"}, {@code "slack"}. */
    String name();

    /**
     * Resolves the recipient's address on this channel itself (device tokens, Slack id). Best-effort:
     * an unreachable recipient is a no-op, and a dead provider may never fail the notification.
     */
    void deliver(String userId, Notification notification, NotificationCategory category);
}
