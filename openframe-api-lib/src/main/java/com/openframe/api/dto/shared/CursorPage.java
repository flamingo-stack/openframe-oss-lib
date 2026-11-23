package com.openframe.api.dto.shared;

import java.util.List;

public record CursorPage<T>(List<T> items, boolean hasNextPage, boolean hasPreviousPage) {

    public static <T> CursorPage<T> assemble(List<T> fetched, CursorPaginationCriteria criteria) {
        throw new UnsupportedOperationException();
    }
}
