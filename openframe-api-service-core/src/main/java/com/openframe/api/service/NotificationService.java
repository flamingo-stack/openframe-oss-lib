package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.NotificationPage;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.NotificationWithStatus;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@Validated
public class NotificationService {

    static final int SEARCH_MIN_LENGTH = 2;

    private final NotificationRepository notificationRepository;
    private final GraphQLNotificationMapper notificationMapper;

    public GenericQueryResult<NotificationView> list(String recipientId,
                                                     RecipientType recipientType,
                                                     @NotNull NotificationFilter filter,
                                                     CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();
        String effectiveSearch = normalizeSearch(filter.search());

        NotificationPage repoPage = notificationRepository.findPageForRecipient(
                recipientId, recipientType, filter.read(), effectiveSearch,
                normalized.getCursor(), normalized.isBackward(), limit + 1);

        boolean hasMore = repoPage.items().size() > limit;
        List<NotificationWithStatus> items = hasMore ? repoPage.items().subList(0, limit) : repoPage.items();

        if (normalized.isBackward()) {
            items = items.reversed();
        }

        List<NotificationView> views = items.stream()
                .map(item -> notificationMapper.toView(item.notification(), item.status() == ReadStatus.READ))
                .toList();

        return GenericQueryResult.<NotificationView>builder()
                .items(views)
                .pageInfo(buildPageInfo(views, hasMore, normalized))
                .build();
    }

    private static String normalizeSearch(String search) {
        if (search == null) {
            return null;
        }
        String trimmed = search.trim();
        return trimmed.length() < SEARCH_MIN_LENGTH ? null : trimmed;
    }

    private PageInfo buildPageInfo(List<NotificationView> items, boolean hasMore,
                                   CursorPaginationCriteria criteria) {
        String firstItemCursor = items.isEmpty() ? null : CursorCodec.encode(items.getFirst().id());
        String lastItemCursor = items.isEmpty() ? null : CursorCodec.encode(items.getLast().id());

        boolean hasNextPage = criteria.isBackward() ? criteria.hasCursor() : hasMore;
        boolean hasPreviousPage = criteria.isBackward() ? hasMore : criteria.hasCursor();

        return PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(firstItemCursor)
                .endCursor(lastItemCursor)
                .build();
    }
}
