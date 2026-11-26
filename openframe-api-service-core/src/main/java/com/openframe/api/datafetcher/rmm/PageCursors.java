package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.core.exception.ValidationException;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

final class PageCursors {

    static final int DEFAULT_PAGE_SIZE = 20;
    static final int MAX_PAGE_SIZE = 100;
    private static final String BEFORE_REQUIRED_WITH_LAST = "before is required with last on this list";

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

    static int resolvePage(Integer first, String after, Integer last, String before) {
        boolean beforeSent = StringUtils.hasText(before);
        if (last != null && !beforeSent) {
            throw new ValidationException(BEFORE_REQUIRED_WITH_LAST);
        }
        if (beforeSent) {
            int cursorPage = decodePage(before);
            return Math.max(0, cursorPage - 1);
        }
        return decodePage(after);
    }

    private static int decodePage(String cursor) {
        if (!StringUtils.hasText(cursor)) {
            return 0;
        }
        int page = parsePage(cursor);
        if (page < 0) {
            throw new InvalidCursorException();
        }
        return page;
    }

    private static int parsePage(String cursor) {
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(cursor);
            String pageIndex = new String(decoded, StandardCharsets.UTF_8);
            return Integer.parseInt(pageIndex);
        } catch (IllegalArgumentException e) {
            throw new InvalidCursorException(e);
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
                .startCursor(edges.isEmpty() && page.page() == 0 ? null : currentCursor)
                .endCursor(nextCursor != null ? nextCursor : (edges.isEmpty() ? null : currentCursor))
                .build();
        return CountedGenericConnection.<GenericEdge<T>>builder()
                .edges(edges)
                .pageInfo(pageInfo)
                .filteredCount(page.filteredCount())
                .build();
    }
}
