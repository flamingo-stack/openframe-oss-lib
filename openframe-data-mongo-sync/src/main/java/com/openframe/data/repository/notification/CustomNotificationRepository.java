package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.RecipientType;

import java.util.List;

public interface CustomNotificationRepository {

    List<NotificationWithStatus> findPageForRecipient(String recipientId, RecipientType recipientType,
                                                      Boolean readFilter, String search,
                                                      String cursor, boolean backward, int limit);
}
