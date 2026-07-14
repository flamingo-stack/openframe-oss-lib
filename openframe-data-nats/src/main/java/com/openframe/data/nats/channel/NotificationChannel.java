package com.openframe.data.nats.channel;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;

/**
 * An out-of-band delivery channel for a notification — OS push today, Slack/email next. The
 * broadcaster injects every registered channel and fans out to all of them, so a new channel is a new
 * bean in its own opt-in module and nothing here changes.
 *
 * <p>Distinct from the NATS publisher, which is the in-app socket path and also serves machines.
 * Channels reach humans out of band.
 */
public interface NotificationChannel {

    /** Short id for logs and metrics, e.g. {@code "fcm"}, {@code "slack"}. */
    String name();

    /**
     * Implementations resolve the recipient's address on the channel themselves (device tokens, Slack
     * id, email) and must be best-effort: a recipient this channel cannot reach is a no-op, not an
     * error, and a dead provider may never fail the notification.
     */
    void deliver(String userId, Notification notification, NotificationCategory category);
}
