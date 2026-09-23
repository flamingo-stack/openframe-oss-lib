package com.openframe.api.dto.shared;

import java.util.List;

public record PageResult<T>(List<T> items, boolean hasNext, boolean hasPrevious, int filteredCount, int page) {

    public static <T> PageResult<T> empty(int page) {
        return new PageResult<>(List.of(), false, false, 0, page);
    }

    public static <T> PageResult<T> slice(List<T> all, int page, Integer perPage) {
        int size = perPage != null && perPage > 0 ? perPage : all.size();
        int from = Math.max(0, page * size);
        int to = size == 0 ? 0 : Math.min(all.size(), from + size);
        List<T> items = from >= to ? List.of() : List.copyOf(all.subList(from, to));
        return new PageResult<>(items, to < all.size(), from > 0, all.size(), page);
    }
}
