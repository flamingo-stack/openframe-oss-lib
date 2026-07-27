package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import com.openframe.stream.service.ScheduleScriptExecutionAggregator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptExecutionStatusUpdateHandlerTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String EXECUTION_ID = "exec-1";
    private static final String MACHINE_ID = "machine-42";
    private static final String SCRIPT_ID = "script-1";

    @Mock
    private ScriptExecutionRepository scriptExecutionRepository;
    @Mock
    private ScheduleScriptExecutionAggregator scheduleScriptExecutionAggregator;

    private ScriptExecutionStatusUpdateHandler handler;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        handler = new ScriptExecutionStatusUpdateHandler(scriptExecutionRepository, scheduleScriptExecutionAggregator);
    }

    @Test
    @DisplayName("getDestination is MONGO_HISTORY — the routing key the processor uses to dispatch SCRIPT_EXECUTED rows here")
    void getDestination_isMongoHistory() {
        assertThat(handler.getDestination()).isEqualTo(Destination.MONGO_HISTORY);
        assertThat(handler.getType()).isEqualTo(EventHandlerType.COMMON_TYPE);
    }

    @Test
    @DisplayName("handle: RUNNING row + exit 0 + no timeout + no error → transitions to SUCCESS; result fields copied verbatim, finishedAt + statusChangedAt set")
    void handle_success_transitionsRowToSuccess() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, 42L, "ok\n", ""), new IntegratedToolEnrichedData());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        ScriptExecution saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(ExecutionStatus.SUCCESS);
        assertThat(saved.getExitCode()).isZero();
        assertThat(saved.getExecutionTimeMs()).isEqualTo(42L);
        assertThat(saved.getTimedOut()).isFalse();
        assertThat(saved.getStdout()).isEqualTo("ok\n");
        assertThat(saved.getStdoutTruncated()).isFalse();
        assertThat(saved.getFinishedAt()).isNotNull();
        assertThat(saved.getStatusChangedAt()).isNotNull();
    }

    @Test
    @DisplayName("handle: non-zero exitCode → FAILED")
    void handle_nonZeroExit_transitionsRowToFailing() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 1, false, null, null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.FAILED);
    }

    @Test
    @DisplayName("handle: timedOut=true → FAILED even with null/zero exitCode")
    void handle_timedOut_transitionsRowToFailing() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, null, true, null, null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(captor.getValue().getTimedOut()).isTrue();
    }

    @Test
    @DisplayName("handle: agent-level error set → FAILED (even with exitCode=0)")
    void handle_agentError_transitionsRowToFailing() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, "SHELL_UNAVAILABLE", null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(captor.getValue().getError()).isEqualTo("SHELL_UNAVAILABLE");
    }

    @Test
    @DisplayName("handle: row already in terminal status (watchdog won the race) → save NOT called, row left as-is")
    void handle_alreadyTerminal_doesNotOverwrite() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        row.setStatus(ExecutionStatus.FAILED);
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, null, null, null), new IntegratedToolEnrichedData());

        verify(scriptExecutionRepository, never()).save(any());
    }

    @Test
    @DisplayName("handle: no Execution row found → save NOT called, no exception (Kafka consumer keeps moving)")
    void handle_rowMissing_skipsSaveQuietly() {
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.empty());

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, null, null, null), new IntegratedToolEnrichedData());

        verify(scriptExecutionRepository, never()).save(any());
    }

    @Test
    @DisplayName("handle: stdout/stderr exceeding MAX_OUTPUT_BYTES are truncated; *Truncated flags set true")
    void handle_truncatesLargeStdoutAndStderr() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.of(row));

        String huge = "x".repeat(ScriptExecution.MAX_OUTPUT_BYTES + 1024);
        handler.handle(messageWith(EXECUTION_ID, 0, false, null, null, huge, huge), new IntegratedToolEnrichedData());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        ScriptExecution saved = captor.getValue();
        assertThat(saved.getStdout().getBytes(StandardCharsets.UTF_8).length)
                .isLessThanOrEqualTo(ScriptExecution.MAX_OUTPUT_BYTES);
        assertThat(saved.getStdoutTruncated()).isTrue();
        assertThat(saved.getStderr().getBytes(StandardCharsets.UTF_8).length)
                .isLessThanOrEqualTo(ScriptExecution.MAX_OUTPUT_BYTES);
        assertThat(saved.getStderrTruncated()).isTrue();
    }

    @Test
    @DisplayName("handle: missing executionId in payload → repo NOT touched, no exception")
    void handle_missingExecutionId_skipsQuietly() {
        DeserializedDebeziumMessage message = new DeserializedDebeziumMessage();
        message.setTenantId(TENANT_ID);
        ObjectNode after = mapper.createObjectNode().put("exitCode", 0);
        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);
        message.setPayload(payload);

        handler.handle(message, new IntegratedToolEnrichedData());

        verifyNoInteractions(scriptExecutionRepository);
    }

    @Test
    @DisplayName("handle: NO tenantId (stream enrichment can't resolve it) → row still matched by (machineId, executionId, scriptId) and transitioned — the fix that stops watchdog false-FAILEDs")
    void handle_noTenantId_stillMatchesAndTransitions() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.of(row));

        DeserializedDebeziumMessage message = new DeserializedDebeziumMessage();
        ObjectNode after = mapper.createObjectNode()
                .put("executionId", EXECUTION_ID)
                .put("machineId", MACHINE_ID)
                .put("scriptId", SCRIPT_ID)
                .put("exitCode", 0);
        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);
        message.setPayload(payload);
        // tenantId intentionally NOT set — mirrors the stream consumer context.

        handler.handle(message, new IntegratedToolEnrichedData());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.SUCCESS);
    }

    @Test
    @DisplayName("handle: missing machineId in payload → repo NOT touched (batch lookup is per-machine under shared executionId)")
    void handle_missingMachineId_skipsQuietly() {
        DeserializedDebeziumMessage message = new DeserializedDebeziumMessage();
        message.setTenantId(TENANT_ID);
        ObjectNode after = mapper.createObjectNode().put("executionId", EXECUTION_ID);
        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);
        message.setPayload(payload);

        handler.handle(message, new IntegratedToolEnrichedData());

        verifyNoInteractions(scriptExecutionRepository);
    }

    @Test
    @DisplayName("handle: result carrying scriptId correlates on (machineId, executionId, scriptId) — the only unambiguous key when a schedule run shares one executionId across scripts")
    void handle_withScriptId_correlatesOnScriptId() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, "script-b"))
                .thenReturn(Optional.of(row));

        DeserializedDebeziumMessage message = messageWith(EXECUTION_ID, 0, false, null, 5L, "ok", "");
        ((ObjectNode) message.getPayload().getAfter()).put("scriptId", "script-b");

        handler.handle(message, new IntegratedToolEnrichedData());

        verify(scriptExecutionRepository).findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, "script-b");
        // Must NOT fall back to the ambiguous two-field lookup when scriptId is present.
        verify(scriptExecutionRepository, never()).findByMachineIdAndExecutionId(any(), any());
        verify(scriptExecutionRepository).save(any(ScriptExecution.class));
    }

    @Test
    @DisplayName("handle: ad-hoc row (no scheduleId) → leaf saved, aggregator NEVER called — nothing to roll up")
    void handle_adHocRow_skipsAggregator() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        row.setScheduleId(null);
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, 5L, "ok", ""), new IntegratedToolEnrichedData());

        verify(scriptExecutionRepository).save(any(ScriptExecution.class));
        verifyNoInteractions(scheduleScriptExecutionAggregator);
    }

    @Test
    @DisplayName("handle: schedule row (scheduleId set) → after leaf save, aggregator invoked with (tenantId, executionId) read from the row")
    void handle_scheduleRow_invokesAggregator() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        row.setScheduleId("sched-99");
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, 5L, "ok", ""), new IntegratedToolEnrichedData());

        verify(scriptExecutionRepository).save(any(ScriptExecution.class));
        // From the row, NOT the wire — the leaf's persisted (tenantId, executionId) is the source of truth.
        verify(scheduleScriptExecutionAggregator).aggregate(TENANT_ID, EXECUTION_ID);
    }

    @Test
    @DisplayName("handle: schedule row already terminal (watchdog raced us) → aggregator STILL invoked once the leaf state is inspected, so a late FAILED still rolls up the header")
    void handle_scheduleRowAlreadyTerminal_skipsAggregatorToo() {
        // If we skipped the save we should NOT run the header aggregation either — no leaf changed.
        ScriptExecution row = runningRow(EXECUTION_ID);
        row.setScheduleId("sched-99");
        row.setStatus(ExecutionStatus.FAILED);
        when(scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptId(MACHINE_ID, EXECUTION_ID, SCRIPT_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, null, null, null), new IntegratedToolEnrichedData());

        verify(scriptExecutionRepository, never()).save(any());
        verifyNoInteractions(scheduleScriptExecutionAggregator);
    }

    @Test
    @DisplayName("handle: missing scriptId (broken/legacy message) → repo NOT touched, no exception — the agent always echoes scriptId")
    void handle_missingScriptId_skipsQuietly() {
        DeserializedDebeziumMessage message = new DeserializedDebeziumMessage();
        message.setTenantId(TENANT_ID);
        ObjectNode after = mapper.createObjectNode()
                .put("executionId", EXECUTION_ID)
                .put("machineId", MACHINE_ID)
                .put("exitCode", 0);
        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);
        message.setPayload(payload);

        handler.handle(message, new IntegratedToolEnrichedData());

        verify(scriptExecutionRepository, never()).findByMachineIdAndExecutionIdAndScriptId(any(), any(), any());
        verify(scriptExecutionRepository, never()).save(any());
    }

    private DeserializedDebeziumMessage messageWith(String executionId,
                                                    Integer exitCode,
                                                    Boolean timedOut,
                                                    String error,
                                                    Long executionTimeMs,
                                                    String stdout,
                                                    String stderr) {
        ObjectNode after = mapper.createObjectNode();
        after.put("executionId", executionId);
        after.put("machineId", MACHINE_ID);
        after.put("scriptId", SCRIPT_ID);
        if (exitCode != null) after.put("exitCode", exitCode);
        if (timedOut != null) after.put("timedOut", timedOut);
        if (error != null) after.put("error", error);
        if (executionTimeMs != null) after.put("executionTimeMs", executionTimeMs);
        if (stdout != null) after.put("stdout", stdout);
        if (stderr != null) after.put("stderr", stderr);

        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);

        DeserializedDebeziumMessage message = new DeserializedDebeziumMessage();
        message.setTenantId(TENANT_ID);
        message.setPayload(payload);
        return message;
    }

    private static ScriptExecution runningRow(String executionId) {
        return ScriptExecution.builder()
                .id("doc-" + executionId)
                .tenantId(TENANT_ID)
                .executionId(executionId)
                .scriptId("script-1")
                .machineId(MACHINE_ID)
                .privilegeLevel(PrivilegeLevel.ADMIN)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(Instant.now())
                .statusChangedAt(Instant.now())
                .build();
    }
}
