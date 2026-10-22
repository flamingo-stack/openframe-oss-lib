package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.RecipientType;
import org.springframework.data.domain.Sort;

public interface CustomNotificationRepository {

    NotificationPage findPageForRecipient(String recipientId, RecipientType recipientType,
                                          Boolean readFilter, String search,
                                          String cursor, boolean backward,
                                          Sort.Direction direction, int limit);

    default NotificationPage findPageForRecipient(String recipientId, RecipientType recipientType,
                                                  Boolean readFilter, String search,
                                                  String cursor, boolean backward, int limit) {
        return findPageForRecipient(recipientId, recipientType, readFilter, search,
                cursor, backward, Sort.Direction.DESC, limit);
    }
}
