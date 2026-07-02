package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.openframe.data.document.rmm.CommandExecution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.CommandExecutionRepository;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * Command counterpart of {@code ScriptExecutionStatusUpdateHandler}: transitions the
 * persisted {@link CommandExecution} row from {@code RUNNING} to {@code SUCCESS} /
 * {@code FAILED} from a {@code COMMAND_EXECUTED} result event, writing the agent's
 * stdout/stderr/exitCode/etc. in place — the source for {@code getBatchResults}.
 *
 * <p>Registered for {@link Destination#MONGO_COMMAND_HISTORY}, routed only for batch
 * commands (a {@code CommandExecution} row exists). Runs ALONGSIDE the Cassandra
 * {@code command_results} write (double-write). Unlike the script handler the row is
 * looked up by {@code (machineId, executionId)} without tenantId, mirroring
 * {@code CommandResultDeserializer} — the command pipeline runs pre-tenant-enrichment.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CommandExecutionStatusUpdateHandler
        implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_EXIT_CODE = "exitCode";
    private static final String FIELD_EXECUTION_TIME_MS = "executionTimeMs";
    private static final String FIELD_TIMED_OUT = "timedOut";
    private static final String FIELD_STDOUT = "stdout";
    private static final String FIELD_STDERR = "stderr";
    private static final String FIELD_ERROR = "error";

    private final CommandExecutionRepository commandExecutionRepository;

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_COMMAND_HISTORY;
    }

    @Override
    public void handle(DeserializedDebeziumMessage message, IntegratedToolEnrichedData extraParams) {
        JsonNode after = message.getPayload() != null ? message.getPayload().getAfter() : null;
        if (after == null) {
            log.warn("Command result has no payload.after — cannot update CommandExecution row");
            return;
        }
        String executionId = stringOrNull(after, FIELD_EXECUTION_ID);
        String machineId = stringOrNull(after, FIELD_MACHINE_ID);
        if (executionId == null || executionId.isBlank() || machineId == null || machineId.isBlank()) {
            log.warn("Command result missing executionId/machineId — cannot update CommandExecution row");
            return;
        }

        commandExecutionRepository.findByMachineIdAndExecutionId(machineId, executionId)
                .ifPresentOrElse(
                        row -> applyResult(row, after),
                        () -> log.warn("No CommandExecution row for executionId={} machineId={} — "
                                + "result arrived before dispatch persisted OR not a tracked batch command",
                                executionId, machineId));
    }

    private void applyResult(CommandExecution row, JsonNode after) {
        if (row.getStatus() != ExecutionStatus.RUNNING) {
            // Watchdog (or a duplicate frame) beat us to it — refuse to overwrite a terminal status.
            log.warn("CommandExecution executionId={} machineId={} is already terminal status={} — refusing to overwrite",
                    row.getExecutionId(), row.getMachineId(), row.getStatus());
            return;
        }

        Integer exitCode = intOrNull(after, FIELD_EXIT_CODE);
        Long executionTimeMs = longOrNull(after, FIELD_EXECUTION_TIME_MS);
        Boolean timedOut = boolOrNull(after, FIELD_TIMED_OUT);
        String stdout = stringOrNull(after, FIELD_STDOUT);
        String stderr = stringOrNull(after, FIELD_STDERR);
        String error = stringOrNull(after, FIELD_ERROR);

        Instant now = Instant.now();
        ExecutionStatus newStatus = decideStatus(exitCode, timedOut, error);
        row.setStatus(newStatus);
        row.setStatusChangedAt(now);
        row.setFinishedAt(now);
        row.setExitCode(exitCode);
        row.setExecutionTimeMs(executionTimeMs);
        row.setTimedOut(timedOut);
        row.setError(error);

        Truncated truncStdout = truncate(stdout);
        row.setStdout(truncStdout.value);
        row.setStdoutTruncated(truncStdout.truncated);
        Truncated truncStderr = truncate(stderr);
        row.setStderr(truncStderr.value);
        row.setStderrTruncated(truncStderr.truncated);

        commandExecutionRepository.save(row);
        log.info("Transitioned CommandExecution row: executionId={} machineId={} status=RUNNING→{} exitCode={} timedOut={}",
                row.getExecutionId(), row.getMachineId(), newStatus, exitCode, timedOut);
    }

    private static ExecutionStatus decideStatus(Integer exitCode, Boolean timedOut, String error) {
        boolean failed = Boolean.TRUE.equals(timedOut)
                || (exitCode != null && exitCode != 0)
                || (error != null && !error.isBlank());
        return failed ? ExecutionStatus.FAILED : ExecutionStatus.SUCCESS;
    }

    /** Truncate to {@link CommandExecution#MAX_OUTPUT_BYTES} on UTF-8 codepoint boundaries. */
    private static Truncated truncate(String value) {
        if (value == null) {
            return new Truncated(null, null);
        }
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        if (bytes.length <= CommandExecution.MAX_OUTPUT_BYTES) {
            return new Truncated(value, Boolean.FALSE);
        }
        String cut = new String(bytes, 0, CommandExecution.MAX_OUTPUT_BYTES, StandardCharsets.UTF_8);
        return new Truncated(cut, Boolean.TRUE);
    }

    private record Truncated(String value, Boolean truncated) {}

    private static String stringOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static Integer intOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asInt();
    }

    private static Long longOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asLong();
    }

    private static Boolean boolOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asBoolean();
    }
}
