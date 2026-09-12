package com.openframe.api.dto.shared;

import java.util.List;

public record PageResult<T>(List<T> items, boolean hasNext, boolean hasPrevious, int filteredCount, int page) {

    public static <T> PageResult<T> empty(int page) {
        return new PageResult<>(List.of(), false, false, 0, page);
    }
}
