package com.openframe.data.service.notification;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.CategoryCount;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@Validated
@RequiredArgsConstructor
public class NotificationReadStateService {

    private final NotificationReadStateRepository repository;

    @Value("${openframe.features.notifications.retention-days:30}")
    private long retentionDays;

    public void createForAudience(@NotBlank String notificationId,
                                  @NotNull NotificationCategory category,
                                  String title,
                                  @NotNull RecipientType recipientType,
                                  @NotEmpty Collection<String> recipientIds) {
        Instant expireAt = Instant.now().plus(Duration.ofDays(retentionDays));
        List<NotificationReadState> rows = new ArrayList<>(recipientIds.size());
        for (String recipientId : recipientIds) {
            rows.add(NotificationReadState.builder()
                    .recipientId(recipientId)
                    .recipientType(recipientType)
                    .notificationId(notificationId)
                    .status(ReadStatus.UNREAD)
                    .category(category)
                    .title(title)
                    .expireAt(expireAt)
                    .build());
        }
        repository.bulkInsertUnordered(rows);
    }

    public boolean hasUnread(@NotBlank String recipientId, @NotNull RecipientType recipientType) {
        return repository.existsByRecipientIdAndRecipientTypeAndStatus(
                recipientId, recipientType, ReadStatus.UNREAD);
    }

    public boolean markRead(@NotBlank String recipientId,
                            @NotNull RecipientType recipientType,
                            @NotBlank String notificationId) {
        return repository.markAsRead(recipientId, recipientType, notificationId) > 0;
    }

    public long markAllAsRead(@NotBlank String recipientId, @NotNull RecipientType recipientType) {
        return repository.markAllAsRead(recipientId, recipientType);
    }

    public boolean deleteNotification(@NotBlank String recipientId,
                                      @NotNull RecipientType recipientType,
                                      @NotBlank String notificationId) {
        return repository.softDelete(recipientId, recipientType, notificationId) > 0;
    }

    public long deleteAllRead(@NotBlank String recipientId, @NotNull RecipientType recipientType) {
        return repository.softDeleteAllRead(recipientId, recipientType);
    }

    public Map<NotificationCategory, Long> unreadCountsByCategory(@NotBlank String recipientId,
                                                                  @NotNull RecipientType recipientType) {
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
