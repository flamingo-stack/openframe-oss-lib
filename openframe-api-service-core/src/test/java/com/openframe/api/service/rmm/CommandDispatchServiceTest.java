package com.openframe.api.service.rmm;

import com.openframe.api.dto.command.CancelDispatchResponse;
import com.openframe.api.dto.command.CancelExecutionInput;
import com.openframe.api.dto.command.CommandDispatchResponse;
import com.openframe.api.dto.command.RunCommandInput;
import com.openframe.data.document.rmm.CommandInitiator;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.nats.rmm.model.CancelMessage;
import com.openframe.data.nats.rmm.model.CommandMessage;
import com.openframe.data.nats.rmm.publisher.CommandNatsPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CommandDispatchServiceTest {

    private static final String MACHINE_ID = "machine-abc";

    @Mock
    private CommandNatsPublisher commandNatsPublisher;

    @InjectMocks
    private CommandDispatchService commandDispatchService;

    private RunCommandInput input;

    @BeforeEach
    void setUp() {
        input = new RunCommandInput();
        input.setMachineId(MACHINE_ID);
        input.setShell(ScriptShell.BASH);
        input.setCommand("df -h");
        input.setInitiator(CommandInitiator.ADMIN);
    }

    @Test
    @DisplayName("runCommand: generates a non-blank executionId, publishes to the target machine with the agent-shaped payload, and returns the same executionId")
    void runCommand_publishesAndReturnsExecutionId() {
        CommandDispatchResponse response = commandDispatchService.runCommand(input);

        assertThat(response.getExecutionId()).isNotBlank();

        ArgumentCaptor<CommandMessage> captor = ArgumentCaptor.forClass(CommandMessage.class);
        verify(commandNatsPublisher).publishCommand(eq(MACHINE_ID), captor.capture());
        CommandMessage sent = captor.getValue();
        assertThat(sent.getExecutionId()).isEqualTo(response.getExecutionId());
        assertThat(sent.getCode()).isEqualTo("df -h");
        assertThat(sent.getShell()).isEqualTo(ScriptShell.BASH);
        assertThat(sent.getInitiator()).isEqualTo(CommandInitiator.ADMIN);
        assertThat(sent.getTimeout()).isNull();   // not provided → agent default
    }

    @Test
    @DisplayName("runCommand: forwards the initiator (USER vs ADMIN) verbatim — the wire payload reflects exactly what the dashboard declared, not a backend default")
    void runCommand_forwardsInitiatorVerbatim() {
        input.setInitiator(CommandInitiator.USER);

        commandDispatchService.runCommand(input);

        ArgumentCaptor<CommandMessage> captor = ArgumentCaptor.forClass(CommandMessage.class);
        verify(commandNatsPublisher).publishCommand(eq(MACHINE_ID), captor.capture());
        // Re-asserts both sides of the enum so the dispatch path can't silently
        // collapse to a single value (e.g. always ADMIN) without breaking this test.
        assertThat(captor.getValue().getInitiator()).isEqualTo(CommandInitiator.USER);
    }

    @Test
    @DisplayName("runCommand: forwards optional timeout verbatim — it is NOT massaged by the backend")
    void runCommand_forwardsOptionalFieldsVerbatim() {
        input.setTimeoutSeconds(90);

        commandDispatchService.runCommand(input);

        ArgumentCaptor<CommandMessage> captor = ArgumentCaptor.forClass(CommandMessage.class);
        verify(commandNatsPublisher).publishCommand(eq(MACHINE_ID), captor.capture());
        CommandMessage sent = captor.getValue();
        assertThat(sent.getTimeout()).isEqualTo(90);
    }

    @Test
    @DisplayName("runCommand: each invocation generates a distinct executionId (no global state leakage)")
    void runCommand_generatesDistinctExecutionIds() {
        String firstId = commandDispatchService.runCommand(input).getExecutionId();
        String secondId = commandDispatchService.runCommand(input).getExecutionId();
        String thirdId = commandDispatchService.runCommand(input).getExecutionId();

        assertThat(List.of(firstId, secondId, thirdId)).doesNotHaveDuplicates();
        verify(commandNatsPublisher, times(3))
                .publishCommand(eq(MACHINE_ID), any(CommandMessage.class));
    }

    @Test
    @DisplayName("cancelExecution: publishes a CancelMessage carrying the supplied executionId to the target machine, and echoes the executionId back")
    void cancelExecution_publishesCancelAndEchoesExecutionId() {
        CancelExecutionInput cancelInput = new CancelExecutionInput();
        cancelInput.setMachineId(MACHINE_ID);
        cancelInput.setExecutionId("exec-abc-123");

        CancelDispatchResponse response = commandDispatchService.cancelExecution(cancelInput);

        assertThat(response.getExecutionId()).isEqualTo("exec-abc-123");

        ArgumentCaptor<CancelMessage> captor = ArgumentCaptor.forClass(CancelMessage.class);
        verify(commandNatsPublisher).publishCancel(eq(MACHINE_ID), captor.capture());
        assertThat(captor.getValue().getExecutionId()).isEqualTo("exec-abc-123");
    }

    @Test
    @DisplayName("cancelExecution: does NOT generate a new executionId — it relays the one supplied by the caller verbatim")
    void cancelExecution_doesNotGenerateNewExecutionId() {
        CancelExecutionInput cancelInput = new CancelExecutionInput();
        cancelInput.setMachineId(MACHINE_ID);
        cancelInput.setExecutionId("exec-original-id");

        commandDispatchService.cancelExecution(cancelInput);
        commandDispatchService.cancelExecution(cancelInput);

        ArgumentCaptor<CancelMessage> captor = ArgumentCaptor.forClass(CancelMessage.class);
        verify(commandNatsPublisher, times(2)).publishCancel(eq(MACHINE_ID), captor.capture());
        // Both cancel publishes carry the same caller-supplied id — service does not mint anything new.
        assertThat(captor.getAllValues()).extracting(CancelMessage::getExecutionId)
                .containsExactly("exec-original-id", "exec-original-id");
    }

    @Test
    @DisplayName("cancelExecution: does NOT call publishCommand — runCommand and cancelExecution take different NATS paths (separate subjects)")
    void cancelExecution_doesNotPublishCommand() {
        CancelExecutionInput cancelInput = new CancelExecutionInput();
        cancelInput.setMachineId(MACHINE_ID);
        cancelInput.setExecutionId("exec-abc-123");

        commandDispatchService.cancelExecution(cancelInput);

        verify(commandNatsPublisher).publishCancel(eq(MACHINE_ID), any(CancelMessage.class));
        verify(commandNatsPublisher, org.mockito.Mockito.never())
                .publishCommand(any(), any());
    }
}
