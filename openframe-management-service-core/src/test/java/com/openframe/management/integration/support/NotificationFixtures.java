package com.openframe.management.integration.support;

import com.openframe.data.document.clientconfiguration.PublishState;
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

    public static Notification withPublishState(String recipientUserId, PublishState state) {
        Notification n = basic(recipientUserId);
        n.setPublishState(state);
        return n;
    }

    public static PublishState published() {
        return PublishState.builder().published(true).publishedAt(Instant.now()).attempts(0).build();
    }

    public static PublishState nonPublishedAttempts(int attempts) {
        return PublishState.builder().published(false).attempts(attempts).build();
    }
}
