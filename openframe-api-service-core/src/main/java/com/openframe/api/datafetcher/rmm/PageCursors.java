package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.PageResult;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

final class PageCursors {

    static final int DEFAULT_PAGE_SIZE = 20;
    static final int MAX_PAGE_SIZE = 100;

    private PageCursors() {
    }

    // first wins over last; a missing or non-positive size gets the default, a larger one is cut to the maximum,
    // so no request makes a list load everything
    static int pageSize(Integer first, Integer last) {
        Integer requested = first != null ? first : last;
        if (requested == null || requested <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(requested, MAX_PAGE_SIZE);
    }

    static int decodePage(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(
                    new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8)));
        } catch (IllegalArgumentException e) {
            return 0;
        }
    }

    static String encodePage(int page) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(Integer.toString(page).getBytes(StandardCharsets.UTF_8));
    }

    static <T> CountedGenericConnection<GenericEdge<T>> toConnection(PageResult<T> page) {
        String currentCursor = encodePage(page.page());
        String nextCursor = page.hasNext() ? encodePage(page.page() + 1) : null;
        List<GenericEdge<T>> edges = page.items().stream()
                .map(node -> GenericEdge.<T>builder().node(node).cursor(currentCursor).build())
                .toList();
        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(page.hasNext())
                .hasPreviousPage(page.hasPrevious())
                .startCursor(edges.isEmpty() ? null : currentCursor)
                .endCursor(nextCursor != null ? nextCursor : (edges.isEmpty() ? null : currentCursor))
                .build();
        return CountedGenericConnection.<GenericEdge<T>>builder()
                .edges(edges)
                .pageInfo(pageInfo)
                .filteredCount(page.filteredCount())
                .build();
    }
}
