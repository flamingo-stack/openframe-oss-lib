package com.openframe.client.service;

import com.openframe.client.metrics.ScriptExecutionWatchdogMetrics;
import com.openframe.client.service.rmm.watchdog.ScheduleJobExecutionWatchdogService;
import com.openframe.client.service.rmm.watchdog.ScriptExecutionWatchdogService;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptExecutionWatchdogServiceTest {

    private static final long GRACE = 120;
    private static final long FALLBACK = 600;

    @Mock
    private ScriptExecutionRepository repository;

    @Mock
    private ScheduleJobExecutionWatchdogService headerWatchdogService;

    private ScriptExecutionWatchdogService service;

    @BeforeEach
    void setUp() {
        service = new ScriptExecutionWatchdogService(repository, headerWatchdogService,
                new ScriptExecutionWatchdogMetrics(new SimpleMeterRegistry()));
        ReflectionTestUtils.setField(service, "graceSeconds", GRACE);
        ReflectionTestUtils.setField(service, "fallbackThresholdSeconds", FALLBACK);
    }

    @Test
    @DisplayName("coarse pre-filter queries RUNNING rows older than min(grace, fallback) — the smallest possible per-row threshold, so nothing stuck is missed")
    void coarsePreFilter_usesMinThresholdFloorAndRunningStatus() {
        when(repository.findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.RUNNING), any()))
                .thenReturn(List.of());
        Instant approxNow = Instant.now();

        service.markStuckExecutionsAsFailed();

        ArgumentCaptor<Instant> captor = ArgumentCaptor.forClass(Instant.class);
        verify(repository).findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.RUNNING), captor.capture());
        // floor = min(120, 600) = 120s before now
        assertThat(captor.getValue()).isBetween(approxNow.minusSeconds(125), approxNow.minusSeconds(115));
        verify(repository, never()).saveAll(any());
    }

    @Test
    @DisplayName("reaps a row that has outlived its own timeout + grace (timeout 60s + 120s grace = 180s; age 200s)")
    void reapsRowPastTimeoutPlusGrace() {
        when(repository.findByStatusAndDispatchedAtBefore(any(), any()))
                .thenReturn(List.of(running(60, 200)));

        service.markStuckExecutionsAsFailed();

        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
    }

    @Test
    @DisplayName("does NOT reap a legitimately long-running script even when it is older than the fixed fallback (timeout 3600s; age 700s > 600 fallback but < 3720 threshold)")
    void doesNotReapLongRunningScript() {
        when(repository.findByStatusAndDispatchedAtBefore(any(), any()))
                .thenReturn(List.of(running(3600, 700)));

        service.markStuckExecutionsAsFailed();

        verify(repository, never()).saveAll(any());
    }

    @Test
    @DisplayName("does NOT reap within the grace window (timeout 60s + 120s grace = 180s; age 150s)")
    void doesNotReapWithinGrace() {
        when(repository.findByStatusAndDispatchedAtBefore(any(), any()))
                .thenReturn(List.of(running(60, 150)));

        service.markStuckExecutionsAsFailed();

        verify(repository, never()).saveAll(any());
    }

    @Test
    @DisplayName("a row dispatched without a timeout falls back to the fixed threshold (600s): reaped at age 700s, spared at age 500s")
    void nullTimeout_usesFixedFallback() {
        ScriptExecution stuck = running(null, 700);
        ScriptExecution fresh = running(null, 500);
        when(repository.findByStatusAndDispatchedAtBefore(any(), any()))
                .thenReturn(List.of(stuck, fresh));

        service.markStuckExecutionsAsFailed();

        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(stuck);
    }

    @Test
    @DisplayName("only the stuck subset is saved; each reaped row gets FAILED + timedOut + finishedAt + an error naming its own threshold")
    void reapsOnlyStuckSubset_andStampsRow() {
        ScriptExecution stuck = running(60, 200);     // threshold 180 < 200 → stuck
        ScriptExecution notStuck = running(600, 200);  // threshold 720 > 200 → fine
        when(repository.findByStatusAndDispatchedAtBefore(any(), any()))
                .thenReturn(List.of(stuck, notStuck));

        service.markStuckExecutionsAsFailed();

        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(stuck);
        assertThat(stuck.getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(stuck.getTimedOut()).isTrue();
        assertThat(stuck.getFinishedAt()).isNotNull();
        assertThat(stuck.getError()).contains("180 seconds");   // 60 timeout + 120 grace
        // the healthy row is untouched
        assertThat(notStuck.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
    }

    @Test
    @DisplayName("no candidates → nothing saved")
    void noCandidates_noSave() {
        when(repository.findByStatusAndDispatchedAtBefore(any(), any())).thenReturn(List.of());

        service.markStuckExecutionsAsFailed();

        verify(repository, never()).saveAll(any());
    }

    @Test
    @DisplayName("reaped rows are handed to the header finalizer once, as a batch (dedup/finalize is the header service's job)")
    void reapedRows_delegatedToHeaderFinalizer() {
        ScriptExecution fireLeafA = scheduleLeaf("t-1", "sch-1", "exec-1", "m-1", 200);
        ScriptExecution fireLeafB = scheduleLeaf("t-1", "sch-1", "exec-1", "m-2", 200);
        ScriptExecution adhoc = running(60, 200);
        when(repository.findByStatusAndDispatchedAtBefore(any(), any()))
                .thenReturn(List.of(fireLeafA, fireLeafB, adhoc));

        service.markStuckExecutionsAsFailed();

        verify(repository).saveAll(any());
        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(headerWatchdogService).finalizeAffectedHeaders(captor.capture());
        assertThat(captor.getValue()).containsExactlyInAnyOrder(fireLeafA, fireLeafB, adhoc);
        verifyNoMoreInteractions(headerWatchdogService);
    }

    @Test
    @DisplayName("no stuck rows → no header finalize attempts")
    void noStuck_noHeaderFinalize() {
        when(repository.findByStatusAndDispatchedAtBefore(any(), any())).thenReturn(List.of());

        service.markStuckExecutionsAsFailed();

        verifyNoInteractions(headerWatchdogService);
    }

    private static ScriptExecution scheduleLeaf(String tenantId, String scheduleId, String executionId,
                                                String machineId, long ageSeconds) {
        return ScriptExecution.builder()
                .id("doc-" + executionId + "-" + machineId)
                .tenantId(tenantId)
                .executionId(executionId)
                .scheduleId(scheduleId)
                .machineId(machineId)
                .status(ExecutionStatus.RUNNING)
                .timeoutSeconds(60)
                .dispatchedAt(Instant.now().minusSeconds(ageSeconds))
                .build();
    }

    private static ScriptExecution running(Integer timeoutSeconds, long ageSeconds) {
        return ScriptExecution.builder()
                .id("doc-" + ageSeconds + "-" + timeoutSeconds)
                .executionId("exec-" + ageSeconds + "-" + timeoutSeconds)
                .machineId("m-1")
                .status(ExecutionStatus.RUNNING)
                .timeoutSeconds(timeoutSeconds)
                .dispatchedAt(Instant.now().minusSeconds(ageSeconds))
                .build();
    }

    @SuppressWarnings("unchecked")
    private static ArgumentCaptor<List<ScriptExecution>> listCaptor() {
        return ArgumentCaptor.forClass(List.class);
    }
}
