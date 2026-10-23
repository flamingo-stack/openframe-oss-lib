package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.execution.ScriptExecutionResponse;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ScriptExecution;
import org.springframework.stereotype.Component;

@Component
public class ScriptExecutionMapper {

    public ScriptExecutionResponse toResponse(ScriptExecution entity) {
        return ScriptExecutionResponse.builder()
                .id(entity.getId())
                .executionId(entity.getExecutionId())
                .scriptId(entity.getScriptId())
                .packageManager(entity.getPackageManager())
                .packageName(entity.getPackageName())
                .softwareAction(entity.getSoftwareAction())
                .scheduleId(entity.getScheduleId())
                .machineId(entity.getMachineId())
                .privilegeLevel(entity.getPrivilegeLevel())
                .initiatedBy(entity.getInitiatedBy())
                .source(entity.getSource() != null ? entity.getSource() : ExecutionSource.MANUAL)
                .status(entity.getStatus())
                .dispatchedAt(entity.getDispatchedAt())
                .statusChangedAt(entity.getStatusChangedAt())
                .finishedAt(entity.getFinishedAt())
                .exitCode(entity.getExitCode())
                .executionTimeMs(entity.getExecutionTimeMs())
                .timedOut(entity.getTimedOut())
                .stdout(entity.getStdout())
                .stdoutTruncated(entity.getStdoutTruncated())
                .stderr(entity.getStderr())
                .stderrTruncated(entity.getStderrTruncated())
                .error(entity.getError())
                .build();
    }
}
