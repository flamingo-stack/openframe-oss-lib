package com.openframe.notification;

import com.openframe.notification.spec.NotificationContext;
import lombok.Getter;

import java.util.Objects;

@Getter
public final class NotificationRequest {

    private final NotificationContext context;

    private NotificationRequest(NotificationContext context) {
        this.context = context;
    }

    public static NotificationRequest of(NotificationContext context) {
        Objects.requireNonNull(context, "context must not be null");
        return new NotificationRequest(context);
    }
}
