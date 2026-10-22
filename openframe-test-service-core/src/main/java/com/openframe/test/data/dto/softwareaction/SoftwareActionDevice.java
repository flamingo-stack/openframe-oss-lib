package com.openframe.test.data.dto.softwareaction;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One target device of a software action with its result; machineId and organizationId are raw ids.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SoftwareActionDevice {
    private String machineId;
    private String hostname;
    private String organizationId;
    private String organizationName;
    private String status;
    private Integer exitCode;
    private String stdout;
    private Boolean stdoutTruncated;
    private String stderr;
    private Boolean stderrTruncated;
    private String error;
    private String dispatchedAt;
    private String finishedAt;
}
