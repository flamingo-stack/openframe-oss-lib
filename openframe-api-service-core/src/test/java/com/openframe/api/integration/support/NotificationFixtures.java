package com.openframe.api.integration.support;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;

import java.time.Instant;

public final class NotificationFixtures {

    private NotificationFixtures() {
    }

    public static Notification basic(String recipientUserId) {
        return Notification.builder()
                .recipientUserId(recipientUserId)
                .title("Welcome aboard")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").payload("{}").build())
                .build();
    }

    public static Notification basic(String recipientUserId, String type) {
        return Notification.builder()
                .recipientUserId(recipientUserId)
                .title(type)
                .createdAt(Instant.now())
                .context(GenericContext.builder().type(type).payload("{}").build())
                .build();
    }
}
