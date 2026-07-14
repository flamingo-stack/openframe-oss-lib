package com.openframe.data.nats.push;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;

/**
 * Sink that delivers a notification to a user's registered devices as an OS push.
 *
 * <p>Deliberately mirrors {@code NotificationNatsPublisher.publishToUser} so the broadcaster treats
 * push as just another per-recipient sink. The broadcaster depends only on this port, never on a
 * provider SDK: implementations live in their own opt-in module ({@code openframe-notification-push}),
 * so services that do not want push get neither the bean nor the SDK on their classpath, and adding
 * a second provider later means adding an implementation rather than touching the broadcaster.
 *
 * <p>Implementations resolve the user's device tokens themselves, render the payload, and MUST be
 * best-effort — a push failure may never fail the notification or the socket delivery.
 */
public interface PushSender {

    /**
     * Fans the notification out to every device registered for the user. A user with no registered
     * devices is a no-op, not an error.
     */
    void sendToUser(String userId, Notification notification, NotificationCategory category);
}
