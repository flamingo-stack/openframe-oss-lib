package com.openframe.api.service.rmm;

import com.openframe.api.dto.command.BatchRunCommandInput;
import com.openframe.api.dto.command.CancelExecutionInput;
import com.openframe.api.dto.command.RunCommandInput;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.DeviceService;
import com.openframe.data.nats.rmm.model.CancelMessage;
import com.openframe.data.nats.rmm.model.CommandMessage;
import com.openframe.data.nats.rmm.publisher.CommandNatsPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Dispatches ad-hoc shell commands from the dashboard to the target agent(s)
 * over <b>core NATS</b> (fire-and-forget), not JetStream.
 *
 * <p>Single {@link #runCommand} and {@link #cancelExecution} are pure transport
 * — nothing is persisted. {@link #batchRunCommand} differs: it records one
 * RUNNING {@code CommandExecution} row per target machine before dispatch (via
 * {@link CommandExecutionService#createBatch}), so a fan-out is never in flight
 * without a durable record, and the agent's result frame later transitions each
 * row to SUCCESS / FAILED in place — same lifecycle as {@code ScriptExecution}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CommandDispatchService {

    private final CommandNatsPublisher commandNatsPublisher;
    private final DeviceService deviceService;
    private final CommandExecutionService commandExecutionService;

    public DispatchResponse runCommand(RunCommandInput input) {
        // Target must be a real (tenant-scoped) machine — don't dispatch into the void.
        deviceService.findByMachineId(input.getMachineId())
                .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + input.getMachineId()));

        String executionId = UUID.randomUUID().toString();

        CommandMessage message = CommandMessage.builder()
                .executionId(executionId)
                .code(input.getCommand())
                .shell(input.getShell())
                .privilegeLevel(input.getPrivilegeLevel())
                .timeout(input.getTimeoutSeconds())
                .build();

        commandNatsPublisher.publishCommand(input.getMachineId(), message);

        log.info("Dispatched command executionId={} machineId={} shell={} privilegeLevel={}",
                executionId, input.getMachineId(), input.getShell(), input.getPrivilegeLevel());
        return DispatchResponse.builder()
                .executionId(executionId)
                .build();
    }

    /**
     * Dispatch one ad-hoc command to several machines under a single shared
     * {@code executionId}, persisting one RUNNING {@code CommandExecution} row per
     * machine first ({@code initiatedBy} attributes the dispatch).
     */
    public DispatchResponse batchRunCommand(BatchRunCommandInput input, String initiatedBy) {
        List<String> machineIds = input.getMachineIds().stream().distinct().toList();

        // Verify every target up front — reject the whole batch if any machine
        // is unknown, so we never half-dispatch.
        for (String machineId : machineIds) {
            deviceService.findByMachineId(machineId)
                    .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + machineId));
        }

        String executionId = UUID.randomUUID().toString();

        // Persist one RUNNING row per machine (tenant-scoped, via the service) before
        // anything hits the wire — the agent's result transitions each row later.
        commandExecutionService.createBatch(executionId, input.getCommand(), input.getShell(),
                machineIds, input.getPrivilegeLevel(), input.getTimeoutSeconds(), initiatedBy);

        // Fan out the same payload (one executionId) to every machine.
        CommandMessage message = CommandMessage.builder()
                .executionId(executionId)
                .code(input.getCommand())
                .shell(input.getShell())
                .privilegeLevel(input.getPrivilegeLevel())
                .timeout(input.getTimeoutSeconds())
                .build();

        machineIds.forEach(machineId -> commandNatsPublisher.publishCommand(machineId, message));

        log.info("Dispatched batch command executionId={} to {} machines", executionId, machineIds.size());
        return DispatchResponse.builder()
                .executionId(executionId)
                .build();
    }

    /**
     * Dispatch a cancel request for an in-flight execution.
     */
    public DispatchResponse cancelExecution(CancelExecutionInput input) {
        CancelMessage message = CancelMessage.builder()
                .executionId(input.getExecutionId())
                .build();

        commandNatsPublisher.publishCancel(input.getMachineId(), message);

        log.info("Dispatched cancel executionId={} machineId={}",
                input.getExecutionId(), input.getMachineId());
        return DispatchResponse.builder()
                .executionId(input.getExecutionId())
                .build();
    }
}
