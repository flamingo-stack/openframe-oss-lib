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
 * over NATS JetStream.
 *
 * <p>This service is intentionally pure transport — it does NOT persist
 * anything on the backend. The agent's response will arrive on a separate
 * result subject and is the execution-service's responsibility. The dashboard
 * correlates the response via {@code executionId}, which is generated here
 * and returned immediately.
 *
 * <p>Asynchronicity: the GraphQL caller is unblocked the moment the NATS
 * publish ack returns — the agent may not have started (or even received)
 * the work yet.
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
                .args(input.getArgs())
                .timeout(input.getTimeoutSeconds())
                .envVars(input.getEnvVars())
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
     *
     * <p>Best-effort and asynchronous (same fire-and-forget semantics as
     * {@link #runCommand(RunCommandInput)}). The dashboard receives an echo
     * of {@code executionId} immediately and learns the actual cancel outcome
     * from the agent's normal terminal response on the result channel.
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
