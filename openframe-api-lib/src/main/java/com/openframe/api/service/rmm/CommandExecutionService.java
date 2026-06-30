package com.openframe.api.service.rmm;

import com.openframe.data.document.rmm.CommandExecution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.repository.rmm.CommandExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Application-level operations on batch-command execution rows — the command
 * counterpart of {@code ScriptExecutionService}. Tenant scoping resolves
 * internally via {@link TenantIdProvider}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CommandExecutionService {

    private final CommandExecutionRepository commandExecutionRepository;
    private final TenantIdProvider tenantIdProvider;

    /**
     * Bulk-persist one {@link ExecutionStatus#RUNNING} row per target machine under a
     * shared {@code executionId} — backs batch command dispatch. Unique constraint is
     * {@code (tenantId, executionId, machineId)}.
     */
    public List<CommandExecution> createBatch(String executionId,
                                              String command,
                                              ScriptShell shell,
                                              List<String> machineIds,
                                              PrivilegeLevel privilegeLevel,
                                              Integer timeoutSeconds,
                                              String initiatedBy) {
        Instant now = Instant.now();
        List<CommandExecution> rows = machineIds.stream()
                .map(machineId -> buildRunningRow(executionId, command, shell, machineId,
                        privilegeLevel, timeoutSeconds, initiatedBy, now))
                .toList();
        List<CommandExecution> saved = commandExecutionRepository.saveAll(rows);
        log.info("Persisted batch command execution rows: executionId={} machineCount={} initiatedBy={} status=RUNNING",
                executionId, machineIds.size(), initiatedBy);
        return saved;
    }

    /**
     * Read back the current execution rows for a batch command dispatch — one row per
     * requested machine that exists. Tenant-scoped; rows may still be
     * {@link ExecutionStatus#RUNNING} when the agent has not reported yet. Mirror of
     * {@code ScriptExecutionService.getBatchResults} — backs the bulk command runner.
     */
    public List<CommandExecution> getBatchResults(String executionId, List<String> machineIds) {
        String tenantId = tenantIdProvider.getTenantId();
        return machineIds.stream()
                .map(machineId -> commandExecutionRepository
                        .findByTenantIdAndExecutionIdAndMachineId(tenantId, executionId, machineId))
                .flatMap(Optional::stream)
                .toList();
    }

    private CommandExecution buildRunningRow(String executionId,
                                             String command,
                                             ScriptShell shell,
                                             String machineId,
                                             PrivilegeLevel privilegeLevel,
                                             Integer timeoutSeconds,
                                             String initiatedBy,
                                             Instant now) {
        return CommandExecution.builder()
                .tenantId(tenantIdProvider.getTenantId())
                .executionId(executionId)
                .command(command)
                .shell(shell)
                .machineId(machineId)
                .privilegeLevel(privilegeLevel)
                .timeoutSeconds(timeoutSeconds)
                .initiatedBy(initiatedBy)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(now)
                .statusChangedAt(now)
                .build();
    }
}
