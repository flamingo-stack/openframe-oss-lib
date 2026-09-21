package com.openframe.api.dto.rmm.execution;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.software.SoftwareAction;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class ScriptExecutionResponse {

    private String id;
    private String executionId;
    private String scriptId;
    private PackageManagerType packageManager;
    private String packageName;
    private SoftwareAction softwareAction;
    private String scheduleId;
    private String machineId;
    private PrivilegeLevel privilegeLevel;
    private String initiatedBy;
    private ExecutionSource source;
    private ExecutionStatus status;

    private Instant dispatchedAt;
    private Instant statusChangedAt;
    private Instant finishedAt;

    private Integer exitCode;
    private Long executionTimeMs;
    private Boolean timedOut;
    private String stdout;
    private Boolean stdoutTruncated;
    private String stderr;
    private Boolean stderrTruncated;
    private String error;
}
