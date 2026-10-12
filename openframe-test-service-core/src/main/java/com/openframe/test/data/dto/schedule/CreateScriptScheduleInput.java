package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// startAt required for DATE_TIME (30-min boundary), null for DEVICE_ONLINE; repeat is whole 30-min slots in seconds or null for one-shot.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateScriptScheduleInput {
    private String name;
    private String description;
    private List<String> supportedPlatforms;
    private List<String> scriptIds;
    private String trigger;
    private String timeReference;
    private String offlineBehavior;
    private Long reconnectWindowSeconds;
    private String startAt;
    private Long repeat;
}
