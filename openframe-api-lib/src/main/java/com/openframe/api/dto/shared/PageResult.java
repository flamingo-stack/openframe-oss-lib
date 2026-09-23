package com.openframe.api.dto.shared;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class PageResult<T> {
    private final List<T> items;
    private final boolean hasNext;
    private final boolean hasPrevious;
    private final int filteredCount;
    private final int page;

    public static <T> PageResult<T> empty(int page) {
        return new PageResult<>(List.of(), false, false, 0, page);
    }
}
