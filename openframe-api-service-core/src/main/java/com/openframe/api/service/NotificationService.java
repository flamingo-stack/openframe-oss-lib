package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.Recipient;
import com.openframe.data.document.notification.UserRecipient;
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

    public GenericQueryResult<NotificationView> list(Recipient recipient,
                                                     CursorPaginationCriteria pagination) {
        return list(recipient, null, pagination);
    }

    public GenericQueryResult<NotificationView> list(Recipient recipient,
                                                     NotificationFilter filter,
                                                     CursorPaginationCriteria pagination) {
        rejectFilterForNonUser(recipient, filter);
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        List<Notification> page = fetchPage(recipient, filter, normalized, limit + 1);

        boolean hasMore = page.size() > limit;
        List<Notification> items = hasMore ? page.subList(0, limit) : page;

        if (normalized.isBackward()) {
            items = items.reversed();
        }

        List<NotificationView> views = withReadFlags(recipient, filter, items);

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

    private static void rejectFilterForNonUser(Recipient recipient, NotificationFilter filter) {
        if (filter == null || !filter.hasReadFilter()) {
            return;
        }
        if (!(recipient instanceof UserRecipient)) {
            throw new IllegalArgumentException("read filter is only supported for UserRecipient");
        }
    }

    private List<Notification> fetchPage(Recipient recipient, NotificationFilter filter, CursorPaginationCriteria criteria, int limit) {
        return switch (recipient) {
            case UserRecipient(String userId) -> notificationRepository.findPageForUser(
                    userId, filter == null ? null : filter.read(),
                    criteria.getCursor(), criteria.isBackward(), limit);
            case MachineRecipient(String machineId) -> notificationRepository.findPageForMachine(
                    machineId, criteria.getCursor(), criteria.isBackward(), limit);
            case BroadcastRecipient ignored ->
                    throw new IllegalArgumentException("BroadcastRecipient is not a queryable inbox owner");
        };
    }

    private List<NotificationView> withReadFlags(Recipient recipient, NotificationFilter filter, List<Notification> items) {
        return switch (recipient) {
            case UserRecipient(String userId) -> applyUserReadFlags(userId, filter, items);
            case MachineRecipient ignored -> items.stream()
                    .map(n -> new NotificationView(n, false))
                    .toList();
            case BroadcastRecipient ignored ->
                    throw new IllegalArgumentException("BroadcastRecipient is not a queryable inbox owner");
        };
    }

    private List<NotificationView> applyUserReadFlags(String userId, NotificationFilter filter, List<Notification> items) {
        if (items.isEmpty()) {
            return List.of();
        }
        if (filter != null && filter.hasReadFilter()) {
            boolean read = filter.read();
            return items.stream()
                    .map(n -> new NotificationView(n, read))
                    .toList();
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
