package com.openframe.stream.service;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.repository.rmm.CustomScriptExecutionRepository.LeafStatusTally;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Locks the header-aggregation contract: leaves-still-running is a no-op, all-terminal
 * decides SUCCESS/FAILED by the presence of any FAILED leaf, and the header transition
 * is delegated to the race-safe repo method (idempotent under concurrent last-leaf races).
 */
@ExtendWith(MockitoExtension.class)
class ScheduleScriptExecutionAggregatorTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String EXECUTION_ID = "exec-1";

    @Mock private ScriptExecutionRepository scriptExecutionRepository;
    @Mock private ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;

    private ScheduleScriptExecutionAggregator aggregator;

    @BeforeEach
    void setUp() {
        aggregator = new ScheduleScriptExecutionAggregator(
                scriptExecutionRepository, scheduleScriptExecutionRepository);
    }

    @Test
    @DisplayName("any leaf still RUNNING → header untouched (transitionIfRunning never called)")
    void anyLeafRunning_shortCircuits() {
        when(scriptExecutionRepository.tallyByExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(new LeafStatusTally(2, 0));

        aggregator.aggregate(TENANT_ID, EXECUTION_ID);

        verify(scheduleScriptExecutionRepository, never())
                .transitionIfRunning(anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("all leaves terminal, none failed → header transition requested with SUCCESS + finishedAt")
    void allTerminalNoFailed_transitionsToSuccess() {
        when(scriptExecutionRepository.tallyByExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(new LeafStatusTally(0, 0));
        when(scheduleScriptExecutionRepository.transitionIfRunning(any(), any(), any(), any()))
                .thenReturn(true);

        aggregator.aggregate(TENANT_ID, EXECUTION_ID);

        ArgumentCaptor<Instant> finishedAt = ArgumentCaptor.forClass(Instant.class);
        verify(scheduleScriptExecutionRepository)
                .transitionIfRunning(eq(TENANT_ID), eq(EXECUTION_ID), eq(ExecutionStatus.SUCCESS), finishedAt.capture());
        assertThat(finishedAt.getValue()).isNotNull();
    }

    @Test
    @DisplayName("all leaves terminal, any FAILED → header transition requested with FAILED (a single failing leaf poisons the whole fire)")
    void allTerminalAnyFailed_transitionsToFailed() {
        when(scriptExecutionRepository.tallyByExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(new LeafStatusTally(0, 1));
        when(scheduleScriptExecutionRepository.transitionIfRunning(any(), any(), any(), any()))
                .thenReturn(true);

        aggregator.aggregate(TENANT_ID, EXECUTION_ID);

        verify(scheduleScriptExecutionRepository)
                .transitionIfRunning(eq(TENANT_ID), eq(EXECUTION_ID), eq(ExecutionStatus.FAILED), any());
    }

    @Test
    @DisplayName("header already terminal (concurrent last-leaf race) → repo returns false, aggregator returns cleanly")
    void headerAlreadyTerminal_noOp() {
        when(scriptExecutionRepository.tallyByExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(new LeafStatusTally(0, 0));
        when(scheduleScriptExecutionRepository.transitionIfRunning(any(), any(), any(), any()))
                .thenReturn(false);   // lost the race

        aggregator.aggregate(TENANT_ID, EXECUTION_ID);   // must not throw

        verify(scheduleScriptExecutionRepository)
                .transitionIfRunning(eq(TENANT_ID), eq(EXECUTION_ID), eq(ExecutionStatus.SUCCESS), any());
    }

    @Test
    @DisplayName("null tenantId or executionId → completely no-op, both repos untouched")
    void nulls_areNoOp() {
        aggregator.aggregate(null, EXECUTION_ID);
        aggregator.aggregate(TENANT_ID, null);
        verify(scriptExecutionRepository, never()).tallyByExecutionId(any(), any());
        verify(scheduleScriptExecutionRepository, never())
                .transitionIfRunning(any(), any(), any(), any());
    }
}
