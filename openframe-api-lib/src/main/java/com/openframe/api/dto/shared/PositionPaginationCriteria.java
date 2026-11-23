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
        return this;
    }

    public boolean hasPosition() {
        return false;
    }
}
