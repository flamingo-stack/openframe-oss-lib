package com.openframe.api.dto.shared;

import com.openframe.data.repository.cursor.CursorPosition;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class PositionPaginationCriteria {

    CursorPosition position;
    Integer limit;
    boolean backward;

    public PositionPaginationCriteria normalize() {
        int requestedLimit = limit != null ? limit : CursorPaginationCriteria.DEFAULT_PAGE_SIZE;
        int atLeastMinimum = Math.max(CursorPaginationCriteria.MIN_PAGE_SIZE, requestedLimit);
        int normalizedLimit = Math.min(atLeastMinimum, CursorPaginationCriteria.MAX_PAGE_SIZE);
        CursorPosition normalizedPosition = position != null ? position : new CursorPosition.None();

        return PositionPaginationCriteria.builder()
                .position(normalizedPosition)
                .limit(normalizedLimit)
                .backward(backward)
                .build();
    }

    public boolean hasPosition() {
        return position != null && !(position instanceof CursorPosition.None);
    }
}
