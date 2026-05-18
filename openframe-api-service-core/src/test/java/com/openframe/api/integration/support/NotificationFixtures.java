package com.openframe.api.integration.support;

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
                .context(GenericContext.builder().type("welcome").payload("{}").build())
                .build();
    }

    public static Notification basic(String type) {
        return Notification.builder()
                .title(type)
                .createdAt(Instant.now())
                .context(GenericContext.builder().type(type).payload("{}").build())
                .build();
    }
}
