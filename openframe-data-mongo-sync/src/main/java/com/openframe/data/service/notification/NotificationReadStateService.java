package com.openframe.data.service.notification;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Map;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationReadStateService {

    private final NotificationReadStateRepository repository;

    public void createForAudience(String notificationId, NotificationCategory category,
                                  RecipientType recipientType, Collection<String> recipientIds) {
        if (isBlank(notificationId) || recipientType == null || recipientIds == null || recipientIds.isEmpty()) {
            return;
        }
        repository.createForAudience(notificationId, category, recipientType, recipientIds);
    }

    public boolean hasUnread(String recipientId, RecipientType recipientType) {
        if (isBlank(recipientId) || recipientType == null) {
            return false;
        }
        return repository.hasUnread(recipientId, recipientType);
    }

    public boolean markRead(String recipientId, RecipientType recipientType, String notificationId) {
        if (isBlank(recipientId) || recipientType == null || isBlank(notificationId)) {
            return false;
        }
        return repository.markRead(recipientId, recipientType, notificationId);
    }

    public long markAllAsRead(String recipientId, RecipientType recipientType) {
        if (isBlank(recipientId) || recipientType == null) {
            return 0L;
        }
        return repository.markAllAsRead(recipientId, recipientType);
    }

    public boolean deleteNotification(String recipientId, RecipientType recipientType, String notificationId) {
        if (isBlank(recipientId) || recipientType == null || isBlank(notificationId)) {
            return false;
        }
        return repository.softDelete(recipientId, recipientType, notificationId);
    }

    public long deleteAllRead(String recipientId, RecipientType recipientType) {
        if (isBlank(recipientId) || recipientType == null) {
            return 0L;
        }
        return repository.softDeleteAllRead(recipientId, recipientType);
    }

    public Map<NotificationCategory, Long> unreadCountsByCategory(String recipientId, RecipientType recipientType) {
        if (isBlank(recipientId) || recipientType == null) {
            return Map.of();
        }
        return repository.unreadCountsByCategory(recipientId, recipientType);
    }
}
