package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.document.rmm.Execution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.ExecutionRepository;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
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
class ExecutionStatusUpdateHandlerTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String EXECUTION_ID = "exec-1";
    private static final String MACHINE_ID = "machine-42";

    @Mock
    private ExecutionRepository executionRepository;

    private ExecutionStatusUpdateHandler handler;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        handler = new ExecutionStatusUpdateHandler(executionRepository);
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
        Execution row = runningRow(EXECUTION_ID);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, 42L, "ok\n", ""), new IntegratedToolEnrichedData());

        ArgumentCaptor<Execution> captor = ArgumentCaptor.forClass(Execution.class);
        verify(executionRepository).save(captor.capture());
        Execution saved = captor.getValue();
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
    @DisplayName("handle: non-zero exitCode → FAILING")
    void handle_nonZeroExit_transitionsRowToFailing() {
        Execution row = runningRow(EXECUTION_ID);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 1, false, null, null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<Execution> captor = ArgumentCaptor.forClass(Execution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.FAILING);
    }

    @Test
    @DisplayName("handle: timedOut=true → FAILING even with null/zero exitCode")
    void handle_timedOut_transitionsRowToFailing() {
        Execution row = runningRow(EXECUTION_ID);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, null, true, null, null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<Execution> captor = ArgumentCaptor.forClass(Execution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.FAILING);
        assertThat(captor.getValue().getTimedOut()).isTrue();
    }

    @Test
    @DisplayName("handle: agent-level error set → FAILING (even with exitCode=0)")
    void handle_agentError_transitionsRowToFailing() {
        Execution row = runningRow(EXECUTION_ID);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, "SHELL_UNAVAILABLE", null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<Execution> captor = ArgumentCaptor.forClass(Execution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.FAILING);
        assertThat(captor.getValue().getError()).isEqualTo("SHELL_UNAVAILABLE");
    }

    @Test
    @DisplayName("handle: row already in terminal status (watchdog won the race) → save NOT called, row left as-is")
    void handle_alreadyTerminal_doesNotOverwrite() {
        Execution row = runningRow(EXECUTION_ID);
        row.setStatus(ExecutionStatus.FAILING);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, null, null, null), new IntegratedToolEnrichedData());

        verify(executionRepository, never()).save(any());
    }

    @Test
    @DisplayName("handle: no Execution row found → save NOT called, no exception (Kafka consumer keeps moving)")
    void handle_rowMissing_skipsSaveQuietly() {
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.empty());

        handler.handle(messageWith(EXECUTION_ID, 0, false, null, null, null, null), new IntegratedToolEnrichedData());

        verify(executionRepository, never()).save(any());
    }

    @Test
    @DisplayName("handle: stdout/stderr exceeding MAX_OUTPUT_BYTES are truncated; *Truncated flags set true")
    void handle_truncatesLargeStdoutAndStderr() {
        Execution row = runningRow(EXECUTION_ID);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        String huge = "x".repeat(Execution.MAX_OUTPUT_BYTES + 1024);
        handler.handle(messageWith(EXECUTION_ID, 0, false, null, null, huge, huge), new IntegratedToolEnrichedData());

        ArgumentCaptor<Execution> captor = ArgumentCaptor.forClass(Execution.class);
        verify(executionRepository).save(captor.capture());
        Execution saved = captor.getValue();
        assertThat(saved.getStdout().getBytes(StandardCharsets.UTF_8).length)
                .isLessThanOrEqualTo(Execution.MAX_OUTPUT_BYTES);
        assertThat(saved.getStdoutTruncated()).isTrue();
        assertThat(saved.getStderr().getBytes(StandardCharsets.UTF_8).length)
                .isLessThanOrEqualTo(Execution.MAX_OUTPUT_BYTES);
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

        verifyNoInteractions(executionRepository);
    }

    @Test
    @DisplayName("handle: missing tenantId (enrichment never ran) → repo NOT touched")
    void handle_missingTenantId_skipsQuietly() {
        DeserializedDebeziumMessage message = new DeserializedDebeziumMessage();
        ObjectNode after = mapper.createObjectNode().put("executionId", EXECUTION_ID);
        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);
        message.setPayload(payload);
        // tenantId not set

        handler.handle(message, new IntegratedToolEnrichedData());

        verifyNoInteractions(executionRepository);
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

    private static Execution runningRow(String executionId) {
        return Execution.builder()
                .id("doc-" + executionId)
                .tenantId(TENANT_ID)
                .executionId(executionId)
                .scriptId("script-1")
                .scriptName("disk usage")
                .machineId(MACHINE_ID)
                .privilegeLevel(PrivilegeLevel.ADMIN)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(Instant.now())
                .statusChangedAt(Instant.now())
                .build();
    }
}
