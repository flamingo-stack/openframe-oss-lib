package com.openframe.data.repository.notification;

import java.util.List;

public record NotificationPage(List<NotificationWithStatus> items) {

    public static NotificationPage of(List<NotificationWithStatus> items) {
        return new NotificationPage(items);
    }
}
