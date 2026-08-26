package com.openframe.client.service;

import com.openframe.client.service.rmm.watchdog.ScheduleJobExecutionWatchdogService;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.schedule.ScheduleScriptExecution;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.repository.rmm.CustomScriptExecutionRepository.LeafStatusCounts;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleJobExecutionWatchdogServiceTest {

    private static final String TENANT = "t-1";
    private static final String EXEC = "exec-1";

    @Mock
    private ScriptExecutionRepository scriptExecutionRepository;
    @Mock
    private ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;

    @InjectMocks
    private ScheduleJobExecutionWatchdogService service;

    @Test
    @DisplayName("any leaf still RUNNING → header left alone (no transition)")
    void anyLeafRunning_noTransition() {
        when(scriptExecutionRepository.countLeavesByStatus(TENANT, EXEC))
                .thenReturn(new LeafStatusCounts(1, 0));   // 1 running

        assertThat(service.finalizeIfSettled(TENANT, EXEC)).isFalse();
        verify(scheduleScriptExecutionRepository, never()).transitionIfRunning(any(), any(), any(), any());
    }

    @Test
    @DisplayName("all leaves terminal with ≥1 failed → header FAILED")
    void anyLeafFailed_headerFailed() {
        when(scriptExecutionRepository.countLeavesByStatus(TENANT, EXEC))
                .thenReturn(new LeafStatusCounts(0, 2));   // 0 running, 2 failed
        when(scheduleScriptExecutionRepository.transitionIfRunning(eq(TENANT), eq(EXEC), eq(ExecutionStatus.FAILED), any()))
                .thenReturn(1L);

        assertThat(service.finalizeIfSettled(TENANT, EXEC)).isTrue();
        verify(scheduleScriptExecutionRepository).transitionIfRunning(eq(TENANT), eq(EXEC), eq(ExecutionStatus.FAILED), any());
    }

    @Test
    @DisplayName("all leaves terminal, none failed, leaves exist → header SUCCESS")
    void allSucceeded_headerSuccess() {
        when(scriptExecutionRepository.countLeavesByStatus(TENANT, EXEC))
                .thenReturn(new LeafStatusCounts(0, 0));   // 0 running, 0 failed
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT, EXEC))
                .thenReturn(Optional.of(new ScriptExecution()));   // at least one leaf exists
        when(scheduleScriptExecutionRepository.transitionIfRunning(eq(TENANT), eq(EXEC), eq(ExecutionStatus.SUCCESS), any()))
                .thenReturn(1L);

        assertThat(service.finalizeIfSettled(TENANT, EXEC)).isTrue();
        verify(scheduleScriptExecutionRepository).transitionIfRunning(eq(TENANT), eq(EXEC), eq(ExecutionStatus.SUCCESS), any());
    }

    @Test
    @DisplayName("no running, no failed, and NO leaves at all → header FAILED (nothing ran, not a misleading SUCCESS)")
    void noLeavesAtAll_headerFailed() {
        when(scriptExecutionRepository.countLeavesByStatus(TENANT, EXEC))
                .thenReturn(new LeafStatusCounts(0, 0));
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT, EXEC))
                .thenReturn(Optional.empty());   // zero leaves
        when(scheduleScriptExecutionRepository.transitionIfRunning(eq(TENANT), eq(EXEC), eq(ExecutionStatus.FAILED), any()))
                .thenReturn(1L);

        assertThat(service.finalizeIfSettled(TENANT, EXEC)).isTrue();
        verify(scheduleScriptExecutionRepository).transitionIfRunning(eq(TENANT), eq(EXEC), eq(ExecutionStatus.FAILED), any());
    }

    @Test
    @DisplayName("sweep finalizes each stuck RUNNING header returned by the threshold query")
    void sweep_finalizesStuckHeaders() {
        ScheduleScriptExecution h1 = header(TENANT, "exec-a");
        ScheduleScriptExecution h2 = header(TENANT, "exec-b");
        when(scheduleScriptExecutionRepository.findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.RUNNING), any()))
                .thenReturn(List.of(h1, h2));
        // both settled with a failure → both flip
        when(scriptExecutionRepository.countLeavesByStatus(eq(TENANT), any()))
                .thenReturn(new LeafStatusCounts(0, 1));
        when(scheduleScriptExecutionRepository.transitionIfRunning(any(), any(), eq(ExecutionStatus.FAILED), any()))
                .thenReturn(1L);

        service.markStuckScheduleJobsAsFailed();

        verify(scheduleScriptExecutionRepository).transitionIfRunning(eq(TENANT), eq("exec-a"), eq(ExecutionStatus.FAILED), any());
        verify(scheduleScriptExecutionRepository).transitionIfRunning(eq(TENANT), eq("exec-b"), eq(ExecutionStatus.FAILED), any());
    }

    private static ScheduleScriptExecution header(String tenantId, String executionId) {
        return ScheduleScriptExecution.builder()
                .tenantId(tenantId)
                .executionId(executionId)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(Instant.now().minusSeconds(1000))
                .build();
    }
}
