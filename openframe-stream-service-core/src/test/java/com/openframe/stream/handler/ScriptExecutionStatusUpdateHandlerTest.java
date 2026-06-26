package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
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

    @Mock
    private ScriptExecutionRepository scriptExecutionRepository;

    private ScriptExecutionStatusUpdateHandler handler;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        handler = new ScriptExecutionStatusUpdateHandler(scriptExecutionRepository);
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
        when(scriptExecutionRepository.findByTenantIdAndExecutionIdAndMachineId(TENANT_ID, EXECUTION_ID, MACHINE_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, 42L, "ok\n", ""), new IntegratedToolEnrichedData());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        ScriptExecution saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(ScriptExecutionStatus.SUCCESS);
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
        when(scriptExecutionRepository.findByTenantIdAndExecutionIdAndMachineId(TENANT_ID, EXECUTION_ID, MACHINE_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 1, false, null, null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ScriptExecutionStatus.FAILED);
    }

    @Test
    @DisplayName("handle: timedOut=true → FAILED even with null/zero exitCode")
    void handle_timedOut_transitionsRowToFailing() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        when(scriptExecutionRepository.findByTenantIdAndExecutionIdAndMachineId(TENANT_ID, EXECUTION_ID, MACHINE_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, null, true, null, null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ScriptExecutionStatus.FAILED);
        assertThat(captor.getValue().getTimedOut()).isTrue();
    }

    @Test
    @DisplayName("handle: agent-level error set → FAILED (even with exitCode=0)")
    void handle_agentError_transitionsRowToFailing() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        when(scriptExecutionRepository.findByTenantIdAndExecutionIdAndMachineId(TENANT_ID, EXECUTION_ID, MACHINE_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, "SHELL_UNAVAILABLE", null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ScriptExecutionStatus.FAILED);
        assertThat(captor.getValue().getError()).isEqualTo("SHELL_UNAVAILABLE");
    }

    @Test
    @DisplayName("handle: row already in terminal status (watchdog won the race) → save NOT called, row left as-is")
    void handle_alreadyTerminal_doesNotOverwrite() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        row.setStatus(ScriptExecutionStatus.FAILED);
        when(scriptExecutionRepository.findByTenantIdAndExecutionIdAndMachineId(TENANT_ID, EXECUTION_ID, MACHINE_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, null, null, null), new IntegratedToolEnrichedData());

        verify(scriptExecutionRepository, never()).save(any());
    }

    @Test
    @DisplayName("handle: no Execution row found → save NOT called, no exception (Kafka consumer keeps moving)")
    void handle_rowMissing_skipsSaveQuietly() {
        when(scriptExecutionRepository.findByTenantIdAndExecutionIdAndMachineId(TENANT_ID, EXECUTION_ID, MACHINE_ID))
                .thenReturn(Optional.empty());

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, null, null, null), new IntegratedToolEnrichedData());

        verify(scriptExecutionRepository, never()).save(any());
    }

    @Test
    @DisplayName("handle: stdout/stderr exceeding MAX_OUTPUT_BYTES are truncated; *Truncated flags set true")
    void handle_truncatesLargeStdoutAndStderr() {
        ScriptExecution row = runningRow(EXECUTION_ID);
        when(scriptExecutionRepository.findByTenantIdAndExecutionIdAndMachineId(TENANT_ID, EXECUTION_ID, MACHINE_ID))
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
    @DisplayName("handle: missing tenantId (enrichment never ran) → repo NOT touched")
    void handle_missingTenantId_skipsQuietly() {
        DeserializedDebeziumMessage message = new DeserializedDebeziumMessage();
        ObjectNode after = mapper.createObjectNode()
                .put("executionId", EXECUTION_ID)
                .put("machineId", MACHINE_ID);
        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);
        message.setPayload(payload);
        // tenantId not set

        handler.handle(message, new IntegratedToolEnrichedData());

        verifyNoInteractions(scriptExecutionRepository);
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
                .status(ScriptExecutionStatus.RUNNING)
                .dispatchedAt(Instant.now())
                .statusChangedAt(Instant.now())
                .build();
    }
}
