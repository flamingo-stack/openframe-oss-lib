package com.openframe.debezium.recovery.gap;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class SnapshotCondition {

    private final String dataCollection;
    private final String filter;

    public boolean isFiltered() {
        return !filter.isBlank();
    }
}
