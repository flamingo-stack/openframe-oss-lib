package com.openframe.api.dto.command;

import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

// one machine's slice of a batch dispatch — command counterpart of ScriptExecutionResponse
@Data
@Builder
public class CommandExecutionResponse {

    private String executionId;
    private String machineId;
    private String command;
    private ScriptShell shell;
    private PrivilegeLevel privilegeLevel;
    private String initiatedBy;
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
