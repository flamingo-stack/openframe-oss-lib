package com.openframe.data.integration.support;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.RecipientScope;

import java.time.Instant;

public final class NotificationFixtures {

    private NotificationFixtures() {
    }

    public static Notification basic(String recipientUserId) {
        return Notification.builder()
                .recipientUserId(recipientUserId)
                .title("Welcome aboard")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").payload("{\"message\":\"hi\"}").build())
                .build();
    }

    public static Notification basic(String recipientUserId, String type, String payload) {
        return Notification.builder()
                .recipientUserId(recipientUserId)
                .title(type)
                .createdAt(Instant.now())
                .context(GenericContext.builder().type(type).payload(payload).build())
                .build();
    }

    public static Notification forMachine(String recipientMachineId, String type, String payload) {
        return Notification.builder()
                .recipientScope(RecipientScope.MACHINE)
                .recipientMachineId(recipientMachineId)
                .title(type)
                .createdAt(Instant.now())
                .context(GenericContext.builder().type(type).payload(payload).build())
                .build();
    }

    public static Notification broadcast(String type, String payload) {
        return Notification.builder()
                .recipientScope(RecipientScope.ALL)
                .title(type)
                .createdAt(Instant.now())
                .context(GenericContext.builder().type(type).payload(payload).build())
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
