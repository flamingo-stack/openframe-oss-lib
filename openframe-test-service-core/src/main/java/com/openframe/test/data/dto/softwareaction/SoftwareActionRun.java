package com.openframe.test.data.dto.softwareaction;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One row of the Software Actions page: one package's install or update across its devices; bundleId and scheduleId are raw ids.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SoftwareActionRun {
    private String id;
    private String executionId;
    private String software;
    private String action;
    private String engine;
    private String status;
    private Integer totalMachineCount;
    private Integer respondedMachineCount;
    private String scheduledAt;
    private String dispatchedAt;
    private String finishedAt;
    private String initiatedBy;
    private String bundleId;
    private String scheduleId;
}
