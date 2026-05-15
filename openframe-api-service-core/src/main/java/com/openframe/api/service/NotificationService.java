package com.openframe.api.service;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.notification.NotificationView;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
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

    private final NotificationRepository notificationRepository;

    public GenericQueryResult<NotificationView> list(String recipientId,
                                                     RecipientType recipientType,
                                                     @NotNull NotificationFilter filter,
                                                     CursorPaginationCriteria pagination) {
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        List<NotificationWithStatus> page = notificationRepository.findPageForRecipient(
                recipientId, recipientType, filter.read(), filter.search(),
                normalized.getCursor(), normalized.isBackward(), limit + 1);

        boolean hasMore = page.size() > limit;
        List<NotificationWithStatus> items = hasMore ? page.subList(0, limit) : page;

        if (normalized.isBackward()) {
            items = items.reversed();
        }

        List<NotificationView> views = items.stream()
                .map(item -> new NotificationView(item.notification(), item.status() == ReadStatus.READ))
                .toList();

        return GenericQueryResult.<NotificationView>builder()
                .items(views)
                .pageInfo(buildPageInfo(views, hasMore, normalized))
                .build();
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
