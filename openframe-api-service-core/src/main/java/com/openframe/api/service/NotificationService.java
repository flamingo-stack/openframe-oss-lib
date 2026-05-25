package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.NotificationPage;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.NotificationWithStatus;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
@Validated
public class NotificationService {

    static final int SEARCH_MIN_LENGTH = 2;
    static final Sort.Direction DEFAULT_SORT_DIRECTION = Sort.Direction.DESC;

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of("id", "createdAt");

    private final NotificationRepository notificationRepository;
    private final GraphQLNotificationMapper notificationMapper;

    public GenericQueryResult<NotificationView> list(String recipientId,
                                                     RecipientType recipientType,
                                                     @NotNull NotificationFilter filter,
                                                     CursorPaginationCriteria pagination) {
        return list(recipientId, recipientType, filter, pagination, null);
    }

    public GenericQueryResult<NotificationView> list(String recipientId,
                                                     RecipientType recipientType,
                                                     @NotNull NotificationFilter filter,
                                                     CursorPaginationCriteria pagination,
                                                     SortInput sort) {
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();
        String effectiveSearch = normalizeSearch(filter.search());
        Sort.Direction direction = resolveSortDirection(sort);

        NotificationPage repoPage = notificationRepository.findPageForRecipient(
                recipientId, recipientType, filter.read(), effectiveSearch,
                normalized.getCursor(), normalized.isBackward(), direction, limit + 1);

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

    private Sort.Direction resolveSortDirection(SortInput sort) {
        if (sort == null) {
            return DEFAULT_SORT_DIRECTION;
        }
        String field = sort.getField();
        if (field != null && !field.isBlank() && !ALLOWED_SORT_FIELDS.contains(field.trim())) {
            log.warn("Invalid sort field requested for notifications: '{}', allowed: {} — falling back to default sort",
                    field, ALLOWED_SORT_FIELDS);
        }
        SortDirection direction = sort.getDirection();
        if (direction == null) {
            return DEFAULT_SORT_DIRECTION;
        }
        return direction == SortDirection.ASC ? Sort.Direction.ASC : Sort.Direction.DESC;
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
