package com.openframe.notification;

import com.openframe.notification.spec.NotificationSeed;
import lombok.Getter;

import java.util.Objects;

@Getter
public final class NotificationRequest {

    private final NotificationSeed seed;

    private NotificationRequest(NotificationSeed seed) {
        this.seed = seed;
    }

    public static NotificationRequest of(NotificationSeed seed) {
        Objects.requireNonNull(seed, "seed must not be null");
        return new NotificationRequest(seed);
    }
}
