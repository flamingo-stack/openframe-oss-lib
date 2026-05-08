package com.openframe.data.integration.support;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.UserRecipient;

import java.time.Instant;

public final class NotificationFixtures {

    private NotificationFixtures() {
    }

    public static Notification basic(String recipientUserId) {
        return Notification.builder()
                .recipient(new UserRecipient(recipientUserId))
                .title("Welcome aboard")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").payload("{\"message\":\"hi\"}").build())
                .build();
    }

    public static Notification basic(String recipientUserId, String type, String payload) {
        return Notification.builder()
                .recipient(new UserRecipient(recipientUserId))
                .title(type)
                .createdAt(Instant.now())
                .context(GenericContext.builder().type(type).payload(payload).build())
                .build();
    }

    public static Notification forMachine(String recipientMachineId, String type, String payload) {
        return Notification.builder()
                .recipient(new MachineRecipient(recipientMachineId))
                .title(type)
                .createdAt(Instant.now())
                .context(GenericContext.builder().type(type).payload(payload).build())
                .build();
    }

    public static Notification broadcast(String type, String payload) {
        return Notification.builder()
                .recipient(new BroadcastRecipient())
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
