package com.openframe.data.nats.channel;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;

public interface NotificationChannel {

    String name();

    /** Must not throw on an unreachable recipient or a dead provider — delivery here may never fail the notification. */
    void deliver(String userId, Notification notification, NotificationCategory category);
}
