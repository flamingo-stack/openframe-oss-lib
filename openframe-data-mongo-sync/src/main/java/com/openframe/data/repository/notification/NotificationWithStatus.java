package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.ReadStatus;

public record NotificationWithStatus(Notification notification, ReadStatus status) {
}
