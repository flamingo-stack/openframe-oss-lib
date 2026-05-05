package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.nats.service.NotificationPublishingService;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.service.notification.NotificationReadStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationPublishingService notificationPublishingService;
    private final NotificationReadStateService readStateService;

    public GenericQueryResult<Notification> listForRecipient(String recipientUserId,
                                                             CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        List<Notification> page = notificationRepository.findPageForUser(
                recipientUserId,
                normalized.getCursor(),
                normalized.isBackward(),
                limit + 1);

        boolean hasMore = page.size() > limit;
        List<Notification> items = hasMore ? page.subList(0, limit) : page;

        if (normalized.isBackward()) {
            items = items.reversed();
        }

        applyReadFlags(recipientUserId, items);

        return GenericQueryResult.<Notification>builder()
                .items(items)
                .pageInfo(buildPageInfo(items, hasMore, normalized))
                .build();
    }

    /** No read flags — machines don't track per-row read state. */
    public GenericQueryResult<Notification> listForMachine(String machineId,
                                                           CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        List<Notification> page = notificationRepository.findPageForMachine(
                machineId,
                normalized.getCursor(),
                normalized.isBackward(),
                limit + 1);

        boolean hasMore = page.size() > limit;
        List<Notification> items = hasMore ? page.subList(0, limit) : page;

        if (normalized.isBackward()) {
            items = items.reversed();
        }

        return GenericQueryResult.<Notification>builder()
                .items(items)
                .pageInfo(buildPageInfo(items, hasMore, normalized))
                .build();
    }

    public boolean hasUnread(String recipientUserId) {
        return readStateService.hasUnread(recipientUserId);
    }

    public boolean markRead(String userId, String notificationId) {
        return readStateService.markRead(userId, notificationId);
    }

    private void applyReadFlags(String userId, List<Notification> items) {
        if (items.isEmpty()) {
            return;
        }
        List<String> ids = items.stream().map(Notification::getId).toList();
        Set<String> readIds = readStateService.findReadIds(userId, ids);
        if (readIds.isEmpty()) {
            return;
        }
        for (Notification notification : items) {
            if (readIds.contains(notification.getId())) {
                notification.setRead(true);
            }
        }
    }

    public Notification create(Notification notification) {
        return notificationPublishingService.create(notification);
    }

    private PageInfo buildPageInfo(List<Notification> items, boolean hasMore, CursorPaginationCriteria criteria) {
        String startCursor = items.isEmpty() ? null : CursorCodec.encode(items.getFirst().getId());
        String endCursor = items.isEmpty() ? null : CursorCodec.encode(items.getLast().getId());

        boolean hasNextPage = !criteria.isBackward() && hasMore;
        boolean hasPreviousPage = criteria.isBackward() ? hasMore : criteria.hasCursor();

        return PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }
}
