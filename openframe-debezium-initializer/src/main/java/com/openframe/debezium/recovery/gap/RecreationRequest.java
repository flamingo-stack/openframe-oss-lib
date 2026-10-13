package com.openframe.debezium.recovery.gap;

import com.openframe.debezium.dto.ConnectorOffsets;
import lombok.Builder;
import lombok.Getter;

import java.util.Map;

@Getter
@Builder
public class RecreationRequest {

    private final String baseName;
    private final String newName;
    private final Map<String, Object> spec;
    private final ConnectorOffsets lastKnownOffsets;
    private final boolean historyLost;
}
