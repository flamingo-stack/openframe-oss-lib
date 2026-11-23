package com.openframe.api.dto.shared;

import java.util.List;

public record CursorPage<T>(List<T> items, boolean hasNextPage, boolean hasPreviousPage) {

    public static <T> CursorPage<T> assemble(List<T> fetched, CursorPaginationCriteria criteria) {
        CursorPaginationCriteria normalized = criteria.normalize();
        int limit = normalized.getLimit();
        boolean backward = normalized.isBackward();
        boolean hasCursor = normalized.hasCursor();
        boolean hasMore = fetched.size() > limit;
        List<T> trimmed = hasMore ? fetched.subList(0, limit) : fetched;
        List<T> items = backward ? trimmed.reversed() : trimmed;
        boolean hasNextPage = backward ? hasCursor : hasMore;
        boolean hasPreviousPage = backward ? hasMore : hasCursor;
        return new CursorPage<>(items, hasNextPage, hasPreviousPage);
    }

    public static <T> CursorPage<T> assemble(List<T> fetched, PositionPaginationCriteria criteria) {
        return new CursorPage<>(fetched, false, false);
    }
}
