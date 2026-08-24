package com.openframe.data.repository.notification;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class NotificationPage {

    private final List<NotificationWithStatus> items;

    public static NotificationPage of(List<NotificationWithStatus> items) {
        return new NotificationPage(items);
    }
}

