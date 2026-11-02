package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSeverity;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class NotificationReadStateFilter {

    public static final NotificationReadStateFilter NONE = NotificationReadStateFilter.builder().build();

    private final Boolean read;
    private final List<NotificationCategory> categories;
    private final List<String> types;
    private final List<NotificationSeverity> severities;
    private final String search;
}
