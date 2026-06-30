package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.document.rmm.CommandExecution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.CommandExecutionRepository;
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
class CommandExecutionStatusUpdateHandlerTest {

    private static final String EXECUTION_ID = "exec-1";
    private static final String MACHINE_ID = "machine-42";

    @Mock
    private CommandExecutionRepository commandExecutionRepository;

    private CommandExecutionStatusUpdateHandler handler;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        handler = new CommandExecutionStatusUpdateHandler(commandExecutionRepository);
    }

    @Test
    @DisplayName("getDestination is MONGO_COMMAND_HISTORY — the routing key for the batch-command write-back")
    void getDestination_isMongoCommandHistory() {
        assertThat(handler.getDestination()).isEqualTo(Destination.MONGO_COMMAND_HISTORY);
        assertThat(handler.getType()).isEqualTo(EventHandlerType.COMMON_TYPE);
    }

    @Test
    @DisplayName("handle: RUNNING row + exit 0 + no timeout + no error → SUCCESS; result fields copied verbatim, finishedAt + statusChangedAt set")
    void handle_success_transitionsRowToSuccess() {
        CommandExecution row = runningRow();
        when(commandExecutionRepository.findByMachineIdAndExecutionId(MACHINE_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(0, false, null, 42L, "ok\n", ""), new IntegratedToolEnrichedData());

        ArgumentCaptor<CommandExecution> captor = ArgumentCaptor.forClass(CommandExecution.class);
        verify(commandExecutionRepository).save(captor.capture());
        CommandExecution saved = captor.getValue();
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
        CommandExecution row = runningRow();
        when(commandExecutionRepository.findByMachineIdAndExecutionId(MACHINE_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(1, false, null, null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<CommandExecution> captor = ArgumentCaptor.forClass(CommandExecution.class);
        verify(commandExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.FAILED);
    }

    @Test
    @DisplayName("handle: timedOut=true → FAILED even with null/zero exitCode")
    void handle_timedOut_transitionsRowToFailing() {
        CommandExecution row = runningRow();
        when(commandExecutionRepository.findByMachineIdAndExecutionId(MACHINE_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(null, true, null, null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<CommandExecution> captor = ArgumentCaptor.forClass(CommandExecution.class);
        verify(commandExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(captor.getValue().getTimedOut()).isTrue();
    }

    @Test
    @DisplayName("handle: agent-level error set → FAILED (even with exitCode=0)")
    void handle_agentError_transitionsRowToFailing() {
        CommandExecution row = runningRow();
        when(commandExecutionRepository.findByMachineIdAndExecutionId(MACHINE_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(0, false, "SHELL_UNAVAILABLE", null, null, null), new IntegratedToolEnrichedData());

        ArgumentCaptor<CommandExecution> captor = ArgumentCaptor.forClass(CommandExecution.class);
        verify(commandExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(captor.getValue().getError()).isEqualTo("SHELL_UNAVAILABLE");
    }

    @Test
    @DisplayName("handle: row already terminal (watchdog/duplicate won the race) → save NOT called")
    void handle_alreadyTerminal_doesNotOverwrite() {
        CommandExecution row = runningRow();
        row.setStatus(ExecutionStatus.FAILED);
        when(commandExecutionRepository.findByMachineIdAndExecutionId(MACHINE_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        handler.handle(messageWith(0, false, null, null, null, null), new IntegratedToolEnrichedData());

        verify(commandExecutionRepository, never()).save(any());
    }

    @Test
    @DisplayName("handle: no CommandExecution row (ad-hoc/legacy command) → save NOT called, no exception")
    void handle_rowMissing_skipsSaveQuietly() {
        when(commandExecutionRepository.findByMachineIdAndExecutionId(MACHINE_ID, EXECUTION_ID))
                .thenReturn(Optional.empty());

        handler.handle(messageWith(0, false, null, null, null, null), new IntegratedToolEnrichedData());

        verify(commandExecutionRepository, never()).save(any());
    }

    @Test
    @DisplayName("handle: stdout/stderr exceeding MAX_OUTPUT_BYTES are truncated; *Truncated flags set true")
    void handle_truncatesLargeStdoutAndStderr() {
        CommandExecution row = runningRow();
        when(commandExecutionRepository.findByMachineIdAndExecutionId(MACHINE_ID, EXECUTION_ID))
                .thenReturn(Optional.of(row));

        String huge = "x".repeat(CommandExecution.MAX_OUTPUT_BYTES + 1024);
        handler.handle(messageWith(0, false, null, null, huge, huge), new IntegratedToolEnrichedData());

        ArgumentCaptor<CommandExecution> captor = ArgumentCaptor.forClass(CommandExecution.class);
        verify(commandExecutionRepository).save(captor.capture());
        CommandExecution saved = captor.getValue();
        assertThat(saved.getStdout().getBytes(StandardCharsets.UTF_8).length)
                .isLessThanOrEqualTo(CommandExecution.MAX_OUTPUT_BYTES);
        assertThat(saved.getStdoutTruncated()).isTrue();
        assertThat(saved.getStderr().getBytes(StandardCharsets.UTF_8).length)
                .isLessThanOrEqualTo(CommandExecution.MAX_OUTPUT_BYTES);
        assertThat(saved.getStderrTruncated()).isTrue();
    }

    @Test
    @DisplayName("handle: missing executionId/machineId in payload → repo NOT touched, no exception")
    void handle_missingIds_skipsQuietly() {
        DeserializedDebeziumMessage message = new DeserializedDebeziumMessage();
        ObjectNode after = mapper.createObjectNode().put("exitCode", 0);   // no executionId/machineId
        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);
        message.setPayload(payload);

        handler.handle(message, new IntegratedToolEnrichedData());

        verifyNoInteractions(commandExecutionRepository);
    }

    private DeserializedDebeziumMessage messageWith(Integer exitCode,
                                                    Boolean timedOut,
                                                    String error,
                                                    Long executionTimeMs,
                                                    String stdout,
                                                    String stderr) {
        ObjectNode after = mapper.createObjectNode();
        after.put("executionId", EXECUTION_ID);
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
        message.setPayload(payload);
        return message;
    }

    private static CommandExecution runningRow() {
        return CommandExecution.builder()
                .id("doc-" + EXECUTION_ID)
                .tenantId("tenant-1")
                .executionId(EXECUTION_ID)
                .command("uptime")
                .shell(ScriptShell.BASH)
                .machineId(MACHINE_ID)
                .privilegeLevel(PrivilegeLevel.ADMIN)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(Instant.now())
                .statusChangedAt(Instant.now())
                .build();
    }
}
