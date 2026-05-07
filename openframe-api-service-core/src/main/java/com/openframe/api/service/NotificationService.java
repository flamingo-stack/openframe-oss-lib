package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationView;
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

    public GenericQueryResult<NotificationView> listForRecipient(String recipientUserId,
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

        List<NotificationView> views = withReadFlags(recipientUserId, items);

        return GenericQueryResult.<NotificationView>builder()
                .items(views)
                .pageInfo(buildPageInfo(views, hasMore, normalized))
                .build();
    }

    /** Machines don't track per-row read state — every view comes back with {@code read=false}. */
    public GenericQueryResult<NotificationView> listForMachine(String machineId,
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

        List<NotificationView> views = items.stream()
                .map(n -> new NotificationView(n, false))
                .toList();

        return GenericQueryResult.<NotificationView>builder()
                .items(views)
                .pageInfo(buildPageInfo(views, hasMore, normalized))
                .build();
    }

    public boolean hasUnread(String recipientUserId) {
        return readStateService.hasUnread(recipientUserId);
    }

    public boolean markRead(String userId, String notificationId) {
        return readStateService.markRead(userId, notificationId);
    }

    public Notification create(Notification notification) {
        return notificationPublishingService.create(notification);
    }

    private List<NotificationView> withReadFlags(String userId, List<Notification> items) {
        if (items.isEmpty()) {
            return List.of();
        }
        List<String> ids = items.stream().map(Notification::getId).toList();
        Set<String> readIds = readStateService.findReadIds(userId, ids);
        return items.stream()
                .map(n -> new NotificationView(n, readIds.contains(n.getId())))
                .toList();
    }

    private PageInfo buildPageInfo(List<NotificationView> items, boolean hasMore, CursorPaginationCriteria criteria) {
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
