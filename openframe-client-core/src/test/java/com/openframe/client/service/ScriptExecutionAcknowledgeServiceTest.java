package com.openframe.client.service;

import com.openframe.client.service.rmm.ScriptExecutionAcknowledgeService;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.nats.rmm.model.ScriptExecutionAcknowledgeMessage;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptExecutionAcknowledgeServiceTest {

    @Mock private ScriptExecutionRepository repository;
    @InjectMocks private ScriptExecutionAcknowledgeService service;

    private static final String EXEC = "exec-1";
    private static final String MACHINE = "m-1";
    private static final List<String> SCRIPTS = List.of("s-a", "s-b");

    @Test
    @DisplayName("ack flips every QUEUED leaf of the delivery to RUNNING in one saveAll")
    void ack_flipsAllQueuedToRunning() {
        ScriptExecution a = leaf("s-a", ExecutionStatus.QUEUED);
        ScriptExecution b = leaf("s-b", ExecutionStatus.QUEUED);
        when(repository.findByMachineIdAndExecutionIdAndScriptIdIn(MACHINE, EXEC, SCRIPTS))
                .thenReturn(List.of(a, b));

        service.acknowledge(ack());

        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactlyInAnyOrder(a, b);
        assertThat(captor.getValue()).allMatch(r -> r.getStatus() == ExecutionStatus.RUNNING);
        assertThat(captor.getValue()).allMatch(r -> r.getStatusChangedAt() != null);
    }

    @Test
    @DisplayName("ack flips only the QUEUED subset; leaves already RUNNING/terminal are left untouched")
    void ack_flipsOnlyQueuedSubset() {
        ScriptExecution queued = leaf("s-a", ExecutionStatus.QUEUED);
        ScriptExecution running = leaf("s-b", ExecutionStatus.RUNNING);
        when(repository.findByMachineIdAndExecutionIdAndScriptIdIn(MACHINE, EXEC, SCRIPTS))
                .thenReturn(List.of(queued, running));

        service.acknowledge(ack());

        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(queued);
        assertThat(running.getStatus()).isEqualTo(ExecutionStatus.RUNNING);   // untouched
    }

    @Test
    @DisplayName("ack whose leaves are all past QUEUED (redelivery / result already applied) is a no-op")
    void ack_noneQueued_noSave() {
        when(repository.findByMachineIdAndExecutionIdAndScriptIdIn(MACHINE, EXEC, SCRIPTS))
                .thenReturn(List.of(leaf("s-a", ExecutionStatus.RUNNING), leaf("s-b", ExecutionStatus.SUCCESS)));

        service.acknowledge(ack());

        verify(repository, never()).saveAll(any());
    }

    @Test
    @DisplayName("ack for a delivery with no matching leaves is a no-op")
    void ack_noLeaves_noOp() {
        when(repository.findByMachineIdAndExecutionIdAndScriptIdIn(MACHINE, EXEC, SCRIPTS))
                .thenReturn(List.of());

        service.acknowledge(ack());

        verify(repository, never()).saveAll(any());
    }

    @Test
    @DisplayName("ack missing ids (null / empty scriptIds) is ignored — repo not touched")
    void ack_missingIds_ignored() {
        service.acknowledge(ScriptExecutionAcknowledgeMessage.builder()
                .executionId(EXEC).machineId(MACHINE).build());   // no scriptIds

        verify(repository, never()).findByMachineIdAndExecutionIdAndScriptIdIn(any(), any(), any());
        verify(repository, never()).saveAll(any());
    }

    @Test
    @DisplayName("ack with an empty scriptIds list is ignored")
    void ack_emptyScriptIds_ignored() {
        service.acknowledge(ScriptExecutionAcknowledgeMessage.builder()
                .executionId(EXEC).machineId(MACHINE).scriptIds(List.of()).build());

        verify(repository, never()).findByMachineIdAndExecutionIdAndScriptIdIn(eq(MACHINE), eq(EXEC), any());
        verify(repository, never()).saveAll(any());
    }

    private static ScriptExecution leaf(String scriptId, ExecutionStatus status) {
        return ScriptExecution.builder()
                .id("row-" + scriptId).tenantId("t-1").executionId(EXEC).machineId(MACHINE).scriptId(scriptId)
                .status(status).build();
    }

    private static ScriptExecutionAcknowledgeMessage ack() {
        return ScriptExecutionAcknowledgeMessage.builder()
                .executionId(EXEC).machineId(MACHINE).scheduleId("sch-1").scriptIds(SCRIPTS).build();
    }

    @SuppressWarnings("unchecked")
    private static ArgumentCaptor<List<ScriptExecution>> listCaptor() {
        return ArgumentCaptor.forClass(List.class);
    }
}
