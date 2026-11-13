package com.openframe.stream.handler.rmm;

import tools.jackson.databind.JsonNode;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.stream.handler.MessageHandler;
import com.openframe.stream.metrics.RmmExecutionMetrics;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import com.openframe.stream.service.rmm.AgentResultReport;
import com.openframe.stream.service.rmm.ExecutionOutcome;
import com.openframe.stream.service.rmm.ExecutionOutcomeClassifier;
import com.openframe.stream.service.rmm.ScheduleScriptExecutionAggregator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

@Component
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_SCRIPT_ID = "scriptId";
    private static final String FIELD_EXIT_CODE = "exitCode";
    private static final String FIELD_EXECUTION_TIME_MS = "executionTimeMs";
    private static final String FIELD_TIMED_OUT = "timedOut";
    private static final String FIELD_STDOUT = "stdout";
    private static final String FIELD_STDERR = "stderr";
    private static final String FIELD_ERROR = "error";
    private static final String FIELD_FAILURE_REASON = "failureReason";

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleScriptExecutionAggregator scheduleScriptExecutionAggregator;
    private final DeviceOnlineDispatchRepository deviceOnlineDispatchRepository;
    private final RmmExecutionMetrics executionMetrics;
    private final ExecutionOutcomeClassifier outcomeClassifier;

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

        // The agent always echoes scriptId, so it is the exact correlation key: a schedule
        // run shares one executionId across all its scripts, and (executionId, machineId)
        // alone would match several rows.
        String scriptId = stringOrNull(after, FIELD_SCRIPT_ID);
        if (scriptId == null || scriptId.isBlank()) {
            log.warn("RMM result has no scriptId — cannot update Execution row (executionId={} machineId={})",
                    executionId, machineId);
            return;
        }

        log.info("Handling SCRIPT result event: executionId={} machineId={} scriptId={}", executionId, machineId, scriptId);

        scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(machineId, executionId, scriptId)
                .ifPresentOrElse(
                        row -> {
                            applyResult(row, after);
                            if (row.getScheduleId() != null) {
                                log.info("Aggregating schedule run: tenantId={} executionId={} scheduleId={}",
                                        row.getTenantId(), row.getExecutionId(), row.getScheduleId());
                                scheduleScriptExecutionAggregator.aggregate(row.getTenantId(), row.getExecutionId());
                            }
                            markDeviceOnlineDispatchProcessed(row.getTenantId(), machineId, row.getScheduleId());
                        },
                        () -> log.warn("No Execution row for executionId={} machineId={} scriptId={} — result arrived before dispatch persisted OR row was never created",
                                executionId, machineId, scriptId));
    }

    private void markDeviceOnlineDispatchProcessed(String tenantId, String machineId, String scheduleId) {
        if (scheduleId == null) {
            log.debug("Script result has no scheduleId — not a DEVICE_ONLINE dispatch, skipping mark-processed (machineId={})", machineId);
            return;
        }
        deviceOnlineDispatchRepository.findByTenantIdAndMachineIdAndScheduleId(tenantId, machineId, scheduleId)
                .ifPresentOrElse(
                        row -> {
                            if (row.getStatus() == DeviceOnlineDispatchStatus.DISPATCHED) {
                                row.setStatus(DeviceOnlineDispatchStatus.PROCESSED);
                                deviceOnlineDispatchRepository.save(row);
                                log.info("DEVICE_ONLINE dispatch marked PROCESSED: tenantId={} machineId={} scheduleId={}",
                                        tenantId, machineId, scheduleId);
                            } else {
                                log.debug("DEVICE_ONLINE dispatch not in DISPATCHED (status={}) — leaving as-is: tenantId={} machineId={} scheduleId={}",
                                        row.getStatus(), tenantId, machineId, scheduleId);
                            }
                        },
                        () -> log.debug("No DEVICE_ONLINE dispatch row for tenantId={} machineId={} scheduleId={} — nothing to mark processed",
                                tenantId, machineId, scheduleId));
    }

    private void applyResult(ScriptExecution row, JsonNode after) {
        ExecutionStatus previous = row.getStatus();
        if (isFinal(row)) {
            log.warn("Execution executionId={} is already in terminal status={} — refusing to overwrite", row.getExecutionId(), previous);
            return;
        }

        Integer exitCode = intOrNull(after, FIELD_EXIT_CODE);
        Long executionTimeMs = longOrNull(after, FIELD_EXECUTION_TIME_MS);
        Boolean timedOut = boolOrNull(after, FIELD_TIMED_OUT);
        String stdout = stringOrNull(after, FIELD_STDOUT);
        String stderr = stringOrNull(after, FIELD_STDERR);
        String error = stringOrNull(after, FIELD_ERROR);
        String agentFailureReason = stringOrNull(after, FIELD_FAILURE_REASON);

        Instant now = Instant.now();
        ExecutionOutcome outcome = outcomeClassifier.classify(
                new AgentResultReport(exitCode, timedOut, error, agentFailureReason), isSystemOwned(row));
        ExecutionStatus newStatus = outcome.status();
        row.setStatus(newStatus);
        row.setFailureReason(outcome.failureReason());
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

        scriptExecutionRepository.save(row);
        executionMetrics.recordScriptCompleted(outcome, row.getSource(), row.getPackageManager(), row.getDispatchedAt(), now);
        log.info("Transitioned Execution row: executionId={} status={}→{} failureReason={} exitCode={} timedOut={}",
                row.getExecutionId(), previous, newStatus, outcome.failureReason(), exitCode, timedOut);
    }

    private static boolean isFinal(ScriptExecution row) {
        ExecutionStatus status = row.getStatus();
        return status != null && status.isFinal(row.getFailureReason());
    }

    private static boolean isSystemOwned(ScriptExecution row) {
        ExecutionSource source = row.getSource();
        return (source != null && source.isSystemOwned()) || row.getSoftwareAction() != null;
    }

    /**
     * Truncate a UTF-8 string so its byte length does not exceed
     * {@link ScriptExecution#MAX_OUTPUT_BYTES}. The truncation respects codepoint
     * boundaries on decode — UTF-8 multi-byte sequences cut in the middle
     * decode into the replacement character at the boundary.
     */
    private static Truncated truncate(String value) {
        if (value == null) {
            return new Truncated(null, null);
        }
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        if (bytes.length <= ScriptExecution.MAX_OUTPUT_BYTES) {
            return new Truncated(value, Boolean.FALSE);
        }
        String cut = new String(bytes, 0, ScriptExecution.MAX_OUTPUT_BYTES, StandardCharsets.UTF_8);
        return new Truncated(cut, Boolean.TRUE);
    }

    private record Truncated(String value, Boolean truncated) {}

    private static String stringOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asString();
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
