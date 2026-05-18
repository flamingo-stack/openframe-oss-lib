package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.RecipientType;

import java.util.Collection;
import java.util.Map;

public interface CustomNotificationReadStateRepository {

    void createForAudience(String notificationId, NotificationCategory category,
                           RecipientType recipientType, Collection<String> recipientIds);

    boolean markRead(String recipientId, RecipientType recipientType, String notificationId);

    long markAllAsRead(String recipientId, RecipientType recipientType);

    boolean softDelete(String recipientId, RecipientType recipientType, String notificationId);

    long softDeleteAllRead(String recipientId, RecipientType recipientType);

    boolean hasUnread(String recipientId, RecipientType recipientType);

    Map<NotificationCategory, Long> unreadCountsByCategory(String recipientId, RecipientType recipientType);
}
