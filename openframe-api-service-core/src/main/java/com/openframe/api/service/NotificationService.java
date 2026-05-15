package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
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

        boolean hasMore;
        List<NotificationWithStatus> items;
        if (repoPage.searchTruncated()) {
            hasMore = true;
            items = repoPage.items();
        } else {
            hasMore = repoPage.items().size() > limit;
            items = hasMore ? repoPage.items().subList(0, limit) : repoPage.items();
        }

        if (normalized.isBackward()) {
            items = items.reversed();
        }

        List<NotificationView> views = items.stream()
                .map(item -> new NotificationView(item.notification(), item.status() == ReadStatus.READ))
                .toList();

        return GenericQueryResult.<NotificationView>builder()
                .items(views)
                .pageInfo(buildPageInfo(views, hasMore, repoPage.resumeCursor(), normalized))
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
                                   String resumeCursorId, CursorPaginationCriteria criteria) {
        String firstItemCursor = items.isEmpty() ? null : CursorCodec.encode(items.getFirst().getId());
        String lastItemCursor = items.isEmpty() ? null : CursorCodec.encode(items.getLast().getId());
        String resumeCursor = resumeCursorId == null ? null : CursorCodec.encode(resumeCursorId);

        String startCursor;
        String endCursor;
        if (criteria.isBackward()) {
            startCursor = resumeCursor != null ? resumeCursor : firstItemCursor;
            endCursor = lastItemCursor;
        } else {
            startCursor = firstItemCursor;
            endCursor = resumeCursor != null ? resumeCursor : lastItemCursor;
        }

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
