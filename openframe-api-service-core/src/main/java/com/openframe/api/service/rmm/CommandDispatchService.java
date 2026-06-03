package com.openframe.api.service.rmm;

import com.openframe.api.dto.command.CancelDispatchResponse;
import com.openframe.api.dto.command.CancelExecutionInput;
import com.openframe.api.dto.command.CommandDispatchResponse;
import com.openframe.api.dto.command.RunCommandInput;
import com.openframe.data.nats.rmm.model.CancelMessage;
import com.openframe.data.nats.rmm.model.CommandMessage;
import com.openframe.data.nats.rmm.publisher.CommandNatsPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Dispatches ad-hoc shell commands from the dashboard to the target agent
 * over <b>core NATS</b> (fire-and-forget), not JetStream.
 *
 * <p>This service is intentionally pure transport — it does NOT persist
 * anything on the backend. The agent's response will arrive on a separate
 * result subject and is the execution-service's responsibility.
 *
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CommandDispatchService {

    private final CommandNatsPublisher commandNatsPublisher;

    public CommandDispatchResponse runCommand(RunCommandInput input) {
        String executionId = UUID.randomUUID().toString();

        CommandMessage message = CommandMessage.builder()
                .executionId(executionId)
                .code(input.getCommand())
                .shell(input.getShell())
                .timeout(input.getTimeoutSeconds())
                .build();

        commandNatsPublisher.publishCommand(input.getMachineId(), message);

        log.info("Dispatched command executionId={} machineId={} shell={}",
                executionId, input.getMachineId(), input.getShell());
        return CommandDispatchResponse.builder()
                .executionId(executionId)
                .build();
    }

    /**
     * Dispatch a cancel request for an in-flight execution.
     */
    public CancelDispatchResponse cancelExecution(CancelExecutionInput input) {
        CancelMessage message = CancelMessage.builder()
                .executionId(input.getExecutionId())
                .build();

        commandNatsPublisher.publishCancel(input.getMachineId(), message);

        log.info("Dispatched cancel executionId={} machineId={}",
                input.getExecutionId(), input.getMachineId());
        return CancelDispatchResponse.builder()
                .executionId(input.getExecutionId())
                .build();
    }
}
