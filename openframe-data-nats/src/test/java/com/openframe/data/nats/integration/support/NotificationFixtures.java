package com.openframe.data.nats.integration.support;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;

import java.time.Instant;

public final class NotificationFixtures {

    private NotificationFixtures() {
    }

    public static Notification basic() {
        return Notification.builder()
                .title("Welcome aboard")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").payload("{\"k\":\"v\"}").build())
                .build();
    }
}
