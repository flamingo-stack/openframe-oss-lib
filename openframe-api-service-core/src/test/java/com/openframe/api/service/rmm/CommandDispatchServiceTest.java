package com.openframe.api.service.rmm;

import com.openframe.api.dto.command.BatchRunCommandInput;
import com.openframe.api.dto.command.CancelExecutionInput;
import com.openframe.api.dto.command.RunCommandInput;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.DeviceService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.CommandExecutionRequest;
import com.openframe.data.document.rmm.CommandExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.nats.rmm.model.CancelMessage;
import com.openframe.data.nats.rmm.model.CommandMessage;
import com.openframe.data.nats.rmm.publisher.CommandNatsPublisher;
import com.openframe.data.repository.rmm.CommandExecutionRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CommandDispatchServiceTest {

    private static final String MACHINE_ID = "machine-abc";

    @Mock
    private CommandNatsPublisher commandNatsPublisher;
    @Mock
    private DeviceService deviceService;
    @Mock
    private CommandExecutionRequestRepository commandExecutionRequestRepository;

    @InjectMocks
    private CommandDispatchService commandDispatchService;

    private RunCommandInput input;

    @BeforeEach
    void setUp() {
        // Target machine exists (happy path). lenient: cancelExecution tests do not look up a machine.
        lenient().when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(new Machine()));

        input = new RunCommandInput();
        input.setMachineId(MACHINE_ID);
        input.setShell(ScriptShell.BASH);
        input.setCommand("df -h");
        input.setPrivilegeLevel(PrivilegeLevel.ADMIN);
    }

    @Test
    @DisplayName("runCommand: a non-existent machine is rejected (DeviceNotFoundException) and nothing is published")
    void runCommand_rejectsUnknownMachine() {
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commandDispatchService.runCommand(input))
                .isInstanceOf(DeviceNotFoundException.class);

        verifyNoInteractions(commandNatsPublisher);
    }

    @Test
    @DisplayName("runCommand: generates a non-blank executionId, publishes to the target machine with the agent-shaped payload, and returns the same executionId")
    void runCommand_publishesAndReturnsExecutionId() {
        DispatchResponse response = commandDispatchService.runCommand(input);

        assertThat(response.getExecutionId()).isNotBlank();

        ArgumentCaptor<CommandMessage> captor = ArgumentCaptor.forClass(CommandMessage.class);
        verify(commandNatsPublisher).publishCommand(eq(MACHINE_ID), captor.capture());
        CommandMessage sent = captor.getValue();
        assertThat(sent.getExecutionId()).isEqualTo(response.getExecutionId());
        assertThat(sent.getCode()).isEqualTo("df -h");
        assertThat(sent.getShell()).isEqualTo(ScriptShell.BASH);
        assertThat(sent.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
        assertThat(sent.getTimeout()).isNull();   // not provided → agent default
    }

    @Test
    @DisplayName("runCommand: forwards the privilegeLevel (USER vs ADMIN) verbatim — the wire payload reflects exactly what the dashboard declared, not a backend default")
    void runCommand_forwardsPrivilegeLevelVerbatim() {
        input.setPrivilegeLevel(PrivilegeLevel.USER);

        commandDispatchService.runCommand(input);

        ArgumentCaptor<CommandMessage> captor = ArgumentCaptor.forClass(CommandMessage.class);
        verify(commandNatsPublisher).publishCommand(eq(MACHINE_ID), captor.capture());
        // Re-asserts both sides of the enum so the dispatch path can't silently
        // collapse to a single value (e.g. always ADMIN) without breaking this test.
        assertThat(captor.getValue().getPrivilegeLevel()).isEqualTo(PrivilegeLevel.USER);
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

        DispatchResponse response = commandDispatchService.cancelExecution(cancelInput);

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

    private BatchRunCommandInput batchInput(List<String> machineIds) {
        BatchRunCommandInput in = new BatchRunCommandInput();
        in.setMachineIds(machineIds);
        in.setShell(ScriptShell.BASH);
        in.setCommand("uptime");
        in.setPrivilegeLevel(PrivilegeLevel.ADMIN);
        return in;
    }

    @Test
    @DisplayName("batchRunCommand: batch-inserts ONE PENDING row per machine (shared executionId, per-row machineId), then fans the same executionId out to each machine, and returns it")
    @SuppressWarnings("unchecked")
    void batchRunCommand_persistsPendingThenFansOut() {
        List<String> machines = List.of("machine-1", "machine-2", "machine-3");
        machines.forEach(id ->
                when(deviceService.findByMachineId(id)).thenReturn(Optional.of(new Machine())));

        DispatchResponse response = commandDispatchService.batchRunCommand(batchInput(machines));

        assertThat(response.getExecutionId()).isNotBlank();

        // One batch insert: a row per machine, every row PENDING and sharing the
        // common batch metadata + executionId, but each pinned to its own machineId.
        ArgumentCaptor<List<CommandExecutionRequest>> rowsCaptor = ArgumentCaptor.forClass(List.class);
        verify(commandExecutionRequestRepository).saveAll(rowsCaptor.capture());
        List<CommandExecutionRequest> saved = rowsCaptor.getValue();
        assertThat(saved).hasSize(3).allSatisfy(row -> {
            assertThat(row.getStatus()).isEqualTo(CommandExecutionStatus.PENDING);
            assertThat(row.getExecutionId()).isEqualTo(response.getExecutionId());
            assertThat(row.getCommand()).isEqualTo("uptime");
            assertThat(row.getShell()).isEqualTo(ScriptShell.BASH);
            assertThat(row.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
        });
        assertThat(saved).extracting(CommandExecutionRequest::getMachineId)
                .containsExactlyInAnyOrderElementsOf(machines);

        // One publish per machine, all carrying the same executionId.
        ArgumentCaptor<CommandMessage> msgCaptor = ArgumentCaptor.forClass(CommandMessage.class);
        for (String id : machines) {
            verify(commandNatsPublisher).publishCommand(eq(id), msgCaptor.capture());
        }
        assertThat(msgCaptor.getAllValues())
                .allSatisfy(m -> assertThat(m.getExecutionId()).isEqualTo(response.getExecutionId()))
                .extracting(CommandMessage::getCode).containsOnly("uptime");
    }

    @Test
    @DisplayName("batchRunCommand: rows are saved BEFORE the first NATS publish — never in flight without a durable record")
    void batchRunCommand_savesBeforePublishing() {
        when(deviceService.findByMachineId("machine-1")).thenReturn(Optional.of(new Machine()));

        commandDispatchService.batchRunCommand(batchInput(List.of("machine-1")));

        InOrder order = inOrder(commandExecutionRequestRepository, commandNatsPublisher);
        order.verify(commandExecutionRequestRepository).saveAll(org.mockito.ArgumentMatchers.anyList());
        order.verify(commandNatsPublisher).publishCommand(eq("machine-1"), any(CommandMessage.class));
    }

    @Test
    @DisplayName("batchRunCommand: duplicate machineIds collapse to one row / one publish — the (machineId, executionId) key stays unique")
    @SuppressWarnings("unchecked")
    void batchRunCommand_dedupsMachineIds() {
        when(deviceService.findByMachineId("machine-1")).thenReturn(Optional.of(new Machine()));

        commandDispatchService.batchRunCommand(batchInput(List.of("machine-1", "machine-1")));

        ArgumentCaptor<List<CommandExecutionRequest>> rowsCaptor = ArgumentCaptor.forClass(List.class);
        verify(commandExecutionRequestRepository).saveAll(rowsCaptor.capture());
        assertThat(rowsCaptor.getValue()).hasSize(1);
        verify(commandNatsPublisher).publishCommand(eq("machine-1"), any(CommandMessage.class));
    }

    @Test
    @DisplayName("batchRunCommand: an unknown machine rejects the whole batch — nothing is persisted and nothing is published")
    void batchRunCommand_rejectsUnknownMachineBeforeAnySideEffect() {
        when(deviceService.findByMachineId("machine-1")).thenReturn(Optional.of(new Machine()));
        when(deviceService.findByMachineId("machine-missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                commandDispatchService.batchRunCommand(batchInput(List.of("machine-1", "machine-missing"))))
                .isInstanceOf(DeviceNotFoundException.class);

        verifyNoInteractions(commandExecutionRequestRepository);
        verifyNoInteractions(commandNatsPublisher);
    }
}
