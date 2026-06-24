package com.openframe.api.mapper;

import com.openframe.api.dto.execution.ExecutionResponse;
import com.openframe.data.document.rmm.Execution;
import org.springframework.stereotype.Component;

/**
 * Pure entity → DTO mapping for {@link Execution}. No business logic, no
 * GraphQL concerns — the connection envelope is assembled higher up in
 * {@code GraphQLExecutionMapper}.
 */
@Component
public class ExecutionMapper {

    public ExecutionResponse toResponse(Execution entity) {
        return ExecutionResponse.builder()
                .id(entity.getId())
                .executionId(entity.getExecutionId())
                .scriptId(entity.getScriptId())
                .scriptName(entity.getScriptName())
                .machineId(entity.getMachineId())
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
