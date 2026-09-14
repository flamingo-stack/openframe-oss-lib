package com.openframe.test.data.dto.execution;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One dispatch of a script to one machine ({@code script-execution.graphqls}). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptExecution {
    private String id;
    private String executionId;
    private String scriptId;
    private String scriptName;
    private String scheduleId;
    private String source;
    private String status;
    private String dispatchedAt;
    private String statusChangedAt;
}
