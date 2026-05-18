package com.openframe.api.dto.notification;

import com.openframe.data.document.notification.NotificationCategory;

public record UnreadCategoryCount(NotificationCategory category, long count) {
}
