package com.openframe.api.dto.shared;

import java.util.List;

public record CursorPage<T>(List<T> items, boolean hasNextPage, boolean hasPreviousPage) {

    public static <T> CursorPage<T> assemble(List<T> fetched, CursorPaginationCriteria criteria) {
        CursorPaginationCriteria normalized = criteria.normalize();
        int limit = normalized.getLimit();
        boolean backward = normalized.isBackward();
        boolean hasCursor = normalized.hasCursor();
        return assemble(fetched, limit, backward, hasCursor);
    }

    public static <T> CursorPage<T> assemble(List<T> fetched, PositionPaginationCriteria criteria) {
        PositionPaginationCriteria normalized = criteria.normalize();
        int limit = normalized.getLimit();
        boolean backward = normalized.isBackward();
        boolean hasCursor = normalized.hasPosition();
        return assemble(fetched, limit, backward, hasCursor);
    }

    private static <T> CursorPage<T> assemble(List<T> fetched, int limit, boolean backward, boolean hasCursor) {
        boolean hasMore = fetched.size() > limit;
        List<T> trimmed = hasMore ? fetched.subList(0, limit) : fetched;
        List<T> items = backward ? trimmed.reversed() : trimmed;
        boolean hasNextPage = backward ? hasCursor : hasMore;
        boolean hasPreviousPage = backward ? hasMore : hasCursor;
        return new CursorPage<>(items, hasNextPage, hasPreviousPage);
    }
}
