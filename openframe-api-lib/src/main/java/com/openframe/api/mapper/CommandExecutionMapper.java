package com.openframe.api.mapper;

import com.openframe.api.dto.command.CommandExecutionResponse;
import com.openframe.data.document.rmm.command.CommandExecution;
import org.springframework.stereotype.Component;

/**
 * Pure entity → DTO mapping for {@link CommandExecution}. Mirrors
 * {@link ScriptExecutionMapper}.
 */
@Component
public class CommandExecutionMapper {

    public CommandExecutionResponse toResponse(CommandExecution entity) {
        return CommandExecutionResponse.builder()
                .executionId(entity.getExecutionId())
                .machineId(entity.getMachineId())
                .command(entity.getCommand())
                .shell(entity.getShell())
                .privilegeLevel(entity.getPrivilegeLevel())
                .initiatedBy(entity.getInitiatedBy())
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
