package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.rmm.software.SoftwareActionKind;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class SoftwareActionDeviceResponse {

    private String machineId;
    private String hostname;
    private String organizationId;
    private String organizationName;
    private SoftwareActionKind kind;
    private DeviceStatus deviceStatus;
    private TelemetryStatus connectivity;
    private Instant lastSeen;
    private SoftwareActionStatus status;

    private String waitingReason;
    private String waitingPhase;
    private Instant closesAt;
    private Instant askAgainAt;
    private Instant deadlineAt;

    private Integer exitCode;
    private String stdout;
    private Boolean stdoutTruncated;
    private String stderr;
    private Boolean stderrTruncated;
    private String error;

    private Instant dispatchedAt;
    private Instant finishedAt;
}
