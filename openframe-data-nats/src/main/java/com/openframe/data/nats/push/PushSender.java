package com.openframe.data.nats.push;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;

/**
 * Push sink for the broadcaster. Implementations live in the opt-in
 * {@code openframe-notification-push} module so no provider SDK reaches this one, which half the
 * platform depends on. Implementations resolve the user's tokens themselves and must be best-effort.
 */
public interface PushSender {

    /** A user with no registered devices is a no-op, not an error. */
    void sendToUser(String userId, Notification notification, NotificationCategory category);
}
