package com.openframe.data.integration.support;

import com.openframe.data.document.notification.Notification;

import java.time.Instant;

public final class NotificationFixtures {

    private NotificationFixtures() {
    }

    public static Notification basic() {
        return basic("welcome");
    }

    public static Notification basic(String type) {
        return Notification.builder()
                .title(type)
                .createdAt(Instant.now())
                .type(type)
                .build();
    }
}
