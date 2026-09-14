package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.RecipientType;
import org.springframework.data.domain.Sort;

import java.util.Optional;

public interface CustomNotificationRepository {

    Optional<Notification> findByAttribute(String attributeKey, String attributeValue);

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
