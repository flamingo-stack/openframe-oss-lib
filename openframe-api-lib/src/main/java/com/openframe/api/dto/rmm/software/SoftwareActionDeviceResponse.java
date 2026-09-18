package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class SoftwareActionDeviceResponse {

    private String machineId;
    private SoftwareActionStatus status;

    private Integer exitCode;
    private String stdout;
    private Boolean stdoutTruncated;
    private String stderr;
    private Boolean stderrTruncated;
    private String error;

    private Instant dispatchedAt;
    private Instant finishedAt;
}
