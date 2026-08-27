package com.openframe.notification.readstate;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.CategoryCount;
import com.openframe.data.repository.notification.EntityCount;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import com.openframe.notification.spec.NotificationEntityRef;
import com.openframe.data.service.TenantIdProvider;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@Validated
@RequiredArgsConstructor
public class NotificationReadStateService {

    private final NotificationReadStateRepository repository;
    private final TenantIdProvider tenantIdProvider;
    private final List<NotificationReadEventListener> readEventListeners;

    public void createForAudience(@NotBlank String notificationId,
                                  @NotNull NotificationCategory category,
                                  String title,
                                  @NotNull RecipientType recipientType,
                                  @NotEmpty Collection<String> recipientIds) {
        createForAudience(notificationId, category, title, null, recipientType, recipientIds);
    }

    public void createForAudience(@NotBlank String notificationId,
                                  @NotNull NotificationCategory category,
                                  String title,
                                  NotificationEntityRef entity,
                                  @NotNull RecipientType recipientType,
                                  @NotEmpty Collection<String> recipientIds) {
        NotificationEntityType entityType = entity == null ? null : entity.type();
        String entityId = entity == null ? null : entity.id();
        List<NotificationReadState> rows = new ArrayList<>(recipientIds.size());
        for (String recipientId : recipientIds) {
            rows.add(NotificationReadState.builder()
                    .recipientId(recipientId)
                    .recipientType(recipientType)
                    .notificationId(notificationId)
                    .status(ReadStatus.UNREAD)
                    .category(category)
                    .entityType(entityType)
                    .entityId(entityId)
                    .title(title)
                    .build());
        }
        repository.bulkInsertUnordered(rows);
    }

    public boolean hasUnread(@NotBlank String recipientId, @NotNull RecipientType recipientType) {
        return repository.existsByRecipientIdAndRecipientTypeAndStatus(
                recipientId, recipientType, ReadStatus.UNREAD);
    }

    public List<NotificationReadState> findRecipients(@NotBlank String notificationId) {
        return repository.findByNotificationId(notificationId);
    }

    public boolean markRead(@NotBlank String recipientId,
                            @NotNull RecipientType recipientType,
                            @NotBlank String notificationId) {
        boolean transitioned = repository.markAsRead(recipientId, recipientType, notificationId) > 0;
        if (transitioned) {
            publish(recipientId, recipientType, List.of(notificationId), NotificationReadEvent.Transition.READ);
        }
        return transitioned;
    }

    public long markAllAsRead(@NotBlank String recipientId, @NotNull RecipientType recipientType) {
        // Snapshot BEFORE the flip: under concurrency the ids can drift from what the flip matches,
        // in both directions. Deliberate — events are best-effort (a throwing listener already loses
        // one) and listeners must be idempotent; exactness would need a transaction.
        List<String> unreadIds = notificationIds(
                repository.findByRecipientIdAndRecipientTypeAndStatus(recipientId, recipientType, ReadStatus.UNREAD));
        long flipped = repository.markAllAsRead(recipientId, recipientType);
        publish(recipientId, recipientType, unreadIds, NotificationReadEvent.Transition.READ);
        return flipped;
    }

    /**
     * Moves a notification out of the active list into history for EVERY recipient at once by
     * flipping their UNREAD rows to READ. Intended for lifecycle-resolve events (e.g. an approval
     * request resolved by one admin) so the notification stops being actionable for all recipients
     * while remaining visible in history. Rows already READ or DELETED are left untouched.
     *
     * @return number of recipient rows moved from UNREAD to READ
     */
    public long dismissForAllRecipients(@NotBlank String notificationId) {
        List<NotificationReadState> unreadRows = repository.findByNotificationId(notificationId).stream()
                .filter(row -> row.getStatus() == ReadStatus.UNREAD)
                .toList();
        long flipped = repository.markAllRecipientsRead(notificationId);
        for (NotificationReadState row : unreadRows) {
            publish(row.getRecipientId(), row.getRecipientType(),
                    List.of(notificationId), NotificationReadEvent.Transition.READ);
        }
        return flipped;
    }

    public boolean deleteNotification(@NotBlank String recipientId,
                                      @NotNull RecipientType recipientType,
                                      @NotBlank String notificationId) {
        boolean transitioned = repository.softDelete(recipientId, recipientType, notificationId) > 0;
        if (transitioned) {
            publish(recipientId, recipientType, List.of(notificationId), NotificationReadEvent.Transition.DELETED);
        }
        return transitioned;
    }

    public long deleteAllRead(@NotBlank String recipientId, @NotNull RecipientType recipientType) {
        List<String> readIds = notificationIds(
                repository.findByRecipientIdAndRecipientTypeAndStatus(recipientId, recipientType, ReadStatus.READ));
        long deleted = repository.softDeleteAllRead(recipientId, recipientType);
        publish(recipientId, recipientType, readIds, NotificationReadEvent.Transition.DELETED);
        return deleted;
    }

    public Map<NotificationCategory, Long> unreadCountsByCategory(@NotBlank String recipientId,
                                                                  @NotNull RecipientType recipientType) {
        List<CategoryCount> rows = repository.unreadCountsByCategory(recipientId, recipientType, tenantIdProvider.getTenantId());
        Map<NotificationCategory, Long> counts = new EnumMap<>(NotificationCategory.class);
        for (CategoryCount row : rows) {
            if (row.category() != null) {
                counts.put(row.category(), row.count());
            }
        }
        return counts;
    }

    /**
     * Unread count per entity of one kind for this recipient. Rows carrying no entity are excluded in
     * the pipeline: a null bucket would surface as a null id in a non-null GraphQL field and take the
     * whole list down with it.
     */
    public Map<String, Long> unreadCountsByEntity(@NotBlank String recipientId,
                                                  @NotNull RecipientType recipientType,
                                                  @NotNull NotificationEntityType entityType) {
        List<EntityCount> rows = repository.unreadCountsByEntity(
                recipientId, recipientType, entityType, tenantIdProvider.getTenantId());
        Map<String, Long> counts = new HashMap<>(rows.size());
        for (EntityCount row : rows) {
            if (row.entityId() != null) {
                counts.put(row.entityId(), row.count());
            }
        }
        return counts;
    }

    /**
     * Clears this recipient's unread rows for one entity — what opening the ticket has to do, since
     * the cards themselves were never clicked. UNREAD only: READ stays put so reopening flips nothing
     * and fires no event, and DELETED stays put so a discarded card cannot come back.
     */
    public long markEntityAsRead(@NotBlank String recipientId,
                                 @NotNull RecipientType recipientType,
                                 @NotNull NotificationEntityType entityType,
                                 @NotBlank String entityId) {
        String tenantId = tenantIdProvider.getTenantId();
        // Snapshot before the flip, with the same caveat markAllAsRead documents: under concurrency the
        // ids can drift either way, and read-event listeners are expected to be idempotent.
        List<String> unreadIds = notificationIds(repository.findByRecipientIdAndRecipientTypeAndEntity(
                recipientId, recipientType, entityType, entityId, ReadStatus.UNREAD, tenantId));
        long flipped = repository.markEntityAsRead(tenantId, recipientId, recipientType, entityType, entityId);
        publish(recipientId, recipientType, unreadIds, NotificationReadEvent.Transition.READ);
        return flipped;
    }

    private void publish(String recipientId, RecipientType recipientType,
                         List<String> notificationIds, NotificationReadEvent.Transition transition) {
        if (notificationIds.isEmpty()) {
            return;
        }
        NotificationReadEvent event =
                new NotificationReadEvent(recipientId, recipientType, List.copyOf(notificationIds), transition);
        for (NotificationReadEventListener listener : readEventListeners) {
            try {
                listener.onReadStateChanged(event);
            } catch (Exception ex) {
                log.warn("Read-event listener {} failed for recipient {} ({} notification(s)): {}",
                        listener.getClass().getSimpleName(), recipientId, notificationIds.size(), ex.getMessage());
            }
        }
    }

    private static List<String> notificationIds(List<NotificationReadState> rows) {
        return rows.stream().map(NotificationReadState::getNotificationId).toList();
    }
}
