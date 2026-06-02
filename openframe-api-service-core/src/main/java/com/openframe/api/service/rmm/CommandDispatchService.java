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
 * result subject and is the execution-service's responsibility. The dashboard
 * correlates the response via {@code executionId}, which is generated here
 * and returned immediately.
 *
 * <p><b>Why core NATS and not JetStream:</b> ad-hoc command dispatch is a
 * live operation — the admin is watching the dashboard right now. Durable
 * delivery would let a command be replayed long after the admin walked
 * away (broker restart, agent reconnect after extended downtime), which
 * is exactly the "ghost execution" failure mode we must avoid for shell
 * commands. The result path back from the agent is a separate concern and
 * legitimately uses JetStream — see execution-service.
 *
 * <p>Asynchronicity: the GraphQL caller is unblocked the moment the NATS
 * publish returns — the agent may not have received the work yet (and if
 * it is offline, will never receive it). The dashboard discovers the real
 * outcome via the agent's terminal frame on the result channel, or via a
 * client-side timeout if no frame ever arrives.
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
