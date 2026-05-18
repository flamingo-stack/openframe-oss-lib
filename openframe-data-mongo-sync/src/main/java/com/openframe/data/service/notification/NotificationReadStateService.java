package com.openframe.data.service.notification;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.CategoryCount;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
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
        NotificationCategory effectiveCategory = category == null ? NotificationCategory.GENERIC : category;
        List<NotificationReadState> rows = new ArrayList<>(recipientIds.size());
        for (String recipientId : recipientIds) {
            rows.add(NotificationReadState.builder()
                    .recipientId(recipientId)
                    .recipientType(recipientType)
                    .notificationId(notificationId)
                    .status(ReadStatus.UNREAD)
                    .category(effectiveCategory)
                    .build());
        }
        repository.bulkInsertUnordered(rows);
    }

    public boolean hasUnread(String recipientId, RecipientType recipientType) {
        if (isBlank(recipientId) || recipientType == null) {
            return false;
        }
        return repository.existsByRecipientIdAndRecipientTypeAndStatus(
                recipientId, recipientType, ReadStatus.UNREAD);
    }

    public boolean markRead(String recipientId, RecipientType recipientType, String notificationId) {
        if (isBlank(recipientId) || recipientType == null || isBlank(notificationId)) {
            return false;
        }
        return repository.markAsRead(recipientId, recipientType, notificationId) > 0;
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
        return repository.softDelete(recipientId, recipientType, notificationId) > 0;
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
        List<CategoryCount> rows = repository.unreadCountsByCategory(recipientId, recipientType);
        Map<NotificationCategory, Long> counts = new EnumMap<>(NotificationCategory.class);
        for (CategoryCount row : rows) {
            if (row.category() != null) {
                counts.put(row.category(), row.count());
            }
        }
        return counts;
    }
}
