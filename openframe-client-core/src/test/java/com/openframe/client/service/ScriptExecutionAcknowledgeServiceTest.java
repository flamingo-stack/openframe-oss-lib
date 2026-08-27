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

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptExecutionAcknowledgeServiceTest {

    @Mock private ScriptExecutionRepository repository;
    @InjectMocks private ScriptExecutionAcknowledgeService service;

    private static final String EXEC = "exec-1";
    private static final String MACHINE = "m-1";
    private static final String SCRIPT = "s-a";

    @Test
    @DisplayName("ack flips a QUEUED leaf to RUNNING")
    void ack_flipsQueuedToRunning() {
        ScriptExecution row = leaf(ExecutionStatus.QUEUED);
        when(repository.findByMachineIdAndExecutionIdAndScriptId(MACHINE, EXEC, SCRIPT)).thenReturn(Optional.of(row));

        service.acknowledge(ack());

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(captor.getValue().getStatusChangedAt()).isNotNull();
    }

    @Test
    @DisplayName("ack on an already-RUNNING (or terminal) leaf does not overwrite — no save")
    void ack_alreadyRunning_noFlip() {
        when(repository.findByMachineIdAndExecutionIdAndScriptId(MACHINE, EXEC, SCRIPT))
                .thenReturn(Optional.of(leaf(ExecutionStatus.RUNNING)));

        service.acknowledge(ack());

        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("ack for a missing leaf is a no-op")
    void ack_missingLeaf_noOp() {
        when(repository.findByMachineIdAndExecutionIdAndScriptId(MACHINE, EXEC, SCRIPT)).thenReturn(Optional.empty());

        service.acknowledge(ack());

        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("ack missing ids is ignored (repo not touched)")
    void ack_missingIds_ignored() {
        service.acknowledge(ScriptExecutionAcknowledgeMessage.builder().machineId(MACHINE).build());  // no executionId/scriptId

        verify(repository, never()).findByMachineIdAndExecutionIdAndScriptId(any(), any(), any());
        verify(repository, never()).save(any());
    }

    private static ScriptExecution leaf(ExecutionStatus status) {
        return ScriptExecution.builder()
                .id("row-1").tenantId("t-1").executionId(EXEC).machineId(MACHINE).scriptId(SCRIPT)
                .status(status).build();
    }

    private static ScriptExecutionAcknowledgeMessage ack() {
        return ScriptExecutionAcknowledgeMessage.builder()
                .executionId(EXEC).machineId(MACHINE).scriptId(SCRIPT).scheduleId("sch-1").build();
    }
}
