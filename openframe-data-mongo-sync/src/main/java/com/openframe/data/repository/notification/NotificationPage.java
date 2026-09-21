package com.openframe.data.repository.notification;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class NotificationPage {

    private final List<NotificationWithStatus> items;

    public static NotificationPage of(List<NotificationWithStatus> items) {
        return new NotificationPage(items);
    }
}

