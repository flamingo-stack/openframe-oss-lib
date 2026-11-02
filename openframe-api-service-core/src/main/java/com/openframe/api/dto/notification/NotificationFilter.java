package com.openframe.api.dto.notification;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.NotificationSeverity;

import java.util.List;

public record NotificationFilter(Boolean read,
                                 List<NotificationCategory> categories,
                                 List<String> types,
                                 List<NotificationSeverity> severities,
                                 String search,
                                 NotificationEntityType entityType,
                                 String entityId) {

    public static final NotificationFilter EMPTY = new NotificationFilter(null, null, null, null, null);

    public NotificationFilter(Boolean read,
                              List<NotificationCategory> categories,
                              List<String> types,
                              List<NotificationSeverity> severities,
                              String search) {
        this(read, categories, types, severities, search, null, null);
    }
}
