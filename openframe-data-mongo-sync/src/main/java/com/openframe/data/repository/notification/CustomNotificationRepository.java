package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.RecipientType;

public interface CustomNotificationRepository {

    NotificationPage findPageForRecipient(String recipientId, RecipientType recipientType,
                                          Boolean readFilter, String search,
                                          String cursor, boolean backward, int limit);
}
