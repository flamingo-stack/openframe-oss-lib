package com.openframe.test.data.generator;

import com.openframe.test.data.dto.shared.CursorPaginationInput;

public class CursorGenerator {

    public static CursorPaginationInput limit(int limit) {
        return CursorPaginationInput.builder().limit(limit).build();
    }
}
