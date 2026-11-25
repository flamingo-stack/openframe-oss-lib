package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Function;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class CursorPageAssembler {

    // The rows were fetched with one over the limit: that one tells whether a next page exists.
    public <E, T> GenericQueryResult<T> toPage(List<E> fetchedItems, CursorPaginationCriteria normalizedPagination,
                                               Function<E, T> toResponse, Function<T, String> cursorOf) {
        int limit = normalizedPagination.getLimit();
        List<T> pageItems = fetchedItems.stream()
                .limit(limit)
                .map(toResponse)
                .toList();
        String startCursor = pageItems.isEmpty() ? null : cursorOf.apply(pageItems.getFirst());
        String endCursor = pageItems.isEmpty() ? null : cursorOf.apply(pageItems.getLast());
        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(fetchedItems.size() > limit)
                .hasPreviousPage(normalizedPagination.hasCursor())
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
        return GenericQueryResult.<T>builder()
                .items(pageItems)
                .pageInfo(pageInfo)
                .build();
    }
}
