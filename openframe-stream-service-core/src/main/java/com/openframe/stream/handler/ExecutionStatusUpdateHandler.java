package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.openframe.data.document.rmm.Execution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.ExecutionRepository;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * Transitions the persisted {@link Execution} row from {@code RUNNING} to
 * {@code SUCCESS} / {@code FAILING} based on an RMM result event consumed
 * from the {@code logs.events} Kafka topic.
 *
 * <p>Lives downstream of the Kafka publish (in {@code stream-service-core})
 * rather than inside {@code RmmResultService} on the producer side — Kafka is
 * the source of truth, this handler is the projection onto the History row.
 * Decoupling client-core from the Execution domain + opening the door to
 * replay-from-Kafka were the drivers.
 *
 * <p>Registered for the {@link Destination#MONGO_HISTORY} destination, which is
 * currently only added to {@code MessageType.SCRIPT_EXECUTED} — Command
 * results have no persisted History row (yet) and so do not route here.
 *
 * <p>Reads typed result fields straight from {@code payload.after} on the
 * underlying Debezium envelope: those fields (exitCode, timedOut, stdout,
 * stderr, error, executionTimeMs) are not surfaced on
 * {@link DeserializedDebeziumMessage} and re-parsing the stringified
 * {@code getDetails()} / {@code getError()} would be wasteful.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ExecutionStatusUpdateHandler
        implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_EXIT_CODE = "exitCode";
    private static final String FIELD_EXECUTION_TIME_MS = "executionTimeMs";
    private static final String FIELD_TIMED_OUT = "timedOut";
    private static final String FIELD_STDOUT = "stdout";
    private static final String FIELD_STDERR = "stderr";
    private static final String FIELD_ERROR = "error";

    private final ExecutionRepository executionRepository;

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_HISTORY;
    }

    @Override
    public void handle(DeserializedDebeziumMessage message, IntegratedToolEnrichedData extraParams) {
        JsonNode after = message.getPayload() != null ? message.getPayload().getAfter() : null;
        if (after == null) {
            log.warn("RMM result has no payload.after — cannot update Execution row");
            return;
        }
        String executionId = stringOrNull(after, FIELD_EXECUTION_ID);
        if (executionId == null || executionId.isBlank()) {
            log.warn("RMM result has no executionId — cannot update Execution row");
            return;
        }
        String machineId = stringOrNull(after, FIELD_MACHINE_ID);
        if (machineId == null || machineId.isBlank()) {
            log.warn("RMM result has no machineId — cannot update Execution row (executionId={})", executionId);
            return;
        }
        String tenantId = message.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            log.warn("RMM result has no tenantId (enrichment did not set it) — cannot update Execution row");
            return;
        }

        executionRepository.findByTenantIdAndExecutionIdAndMachineId(tenantId, executionId, machineId)
                .ifPresentOrElse(
                        row -> applyResult(row, after),
                        () -> log.warn("No Execution row for tenantId={} executionId={} machineId={} — result arrived before dispatch persisted OR row was never created",
                                tenantId, executionId, machineId));
    }

    private void applyResult(Execution row, JsonNode after) {
        if (row.getStatus() != ExecutionStatus.RUNNING) {
            // Watchdog beat us to it — refuse to overwrite a terminal status.
            log.warn("Execution executionId={} is already in terminal status={} — refusing to overwrite",
                    row.getExecutionId(), row.getStatus());
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

        executionRepository.save(row);
        log.info("Transitioned Execution row: executionId={} status=RUNNING→{} exitCode={} timedOut={}",
                row.getExecutionId(), newStatus, exitCode, timedOut);
    }

    private static ExecutionStatus decideStatus(Integer exitCode, Boolean timedOut, String error) {
        boolean failed = Boolean.TRUE.equals(timedOut)
                || (exitCode != null && exitCode != 0)
                || (error != null && !error.isBlank());
        return failed ? ExecutionStatus.FAILED : ExecutionStatus.SUCCESS;
    }

    /**
     * Truncate a UTF-8 string so its byte length does not exceed
     * {@link Execution#MAX_OUTPUT_BYTES}. The truncation respects codepoint
     * boundaries on decode — UTF-8 multi-byte sequences cut in the middle
     * decode into the replacement character at the boundary.
     */
    private static Truncated truncate(String value) {
        if (value == null) {
            return new Truncated(null, null);
        }
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        if (bytes.length <= Execution.MAX_OUTPUT_BYTES) {
            return new Truncated(value, Boolean.FALSE);
        }
        String cut = new String(bytes, 0, Execution.MAX_OUTPUT_BYTES, StandardCharsets.UTF_8);
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
