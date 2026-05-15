package com.openframe.data.repository.notification;

import java.util.List;

public record NotificationPage(List<NotificationWithStatus> items,
                               boolean searchTruncated,
                               String resumeCursor,
                               int iterationsConsumed) {

    public static NotificationPage of(List<NotificationWithStatus> items) {
        return new NotificationPage(items, false, null, 1);
    }

    public static NotificationPage streamed(List<NotificationWithStatus> items, int iterationsConsumed) {
        return new NotificationPage(items, false, null, iterationsConsumed);
    }

    public static NotificationPage truncated(List<NotificationWithStatus> items,
                                             String resumeCursor,
                                             int iterationsConsumed) {
        return new NotificationPage(items, true, resumeCursor, iterationsConsumed);
    }
}
