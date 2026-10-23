package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.RecipientType;
import org.springframework.data.domain.Sort;

public interface CustomNotificationRepository {

    NotificationPage findPageForRecipient(String recipientId, RecipientType recipientType,
                                          NotificationReadStateFilter filter,
                                          String cursor, boolean backward,
                                          Sort.Direction direction, int limit);

    long countForRecipient(String recipientId, RecipientType recipientType, NotificationReadStateFilter filter);

    default NotificationPage findPageForRecipient(String recipientId, RecipientType recipientType,
                                                  Boolean readFilter, String search,
                                                  String cursor, boolean backward,
                                                  Sort.Direction direction, int limit) {
        NotificationReadStateFilter filter = NotificationReadStateFilter.builder()
                .read(readFilter)
                .search(search)
                .build();
        return findPageForRecipient(recipientId, recipientType, filter, cursor, backward, direction, limit);
    }

    default NotificationPage findPageForRecipient(String recipientId, RecipientType recipientType,
                                                  Boolean readFilter, String search,
                                                  String cursor, boolean backward, int limit) {
        return findPageForRecipient(recipientId, recipientType, readFilter, search,
                cursor, backward, Sort.Direction.DESC, limit);
    }
}
