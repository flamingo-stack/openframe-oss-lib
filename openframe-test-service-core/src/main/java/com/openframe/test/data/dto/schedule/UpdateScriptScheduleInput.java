package com.openframe.test.data.dto.schedule;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Full-replacement PUT: null clears an optional field (nulls are serialised on purpose, no NON_NULL filter); name/trigger cannot be null.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateScriptScheduleInput {
    private String id;
    private String name;
    private String description;
    private List<String> supportedPlatforms;
    private List<String> scriptIds;
    private String trigger;
    private String timeReference;
    private String offlineBehavior;
    private Long reconnectWindowSeconds;
    private String selectionMode;
    private String startAt;
    private Long repeat;
}
