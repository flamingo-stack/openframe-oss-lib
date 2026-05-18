package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationCategory;
import org.springframework.data.mongodb.core.mapping.Field;

public record CategoryCount(
        @Field("_id") NotificationCategory category,
        long count) {
}
