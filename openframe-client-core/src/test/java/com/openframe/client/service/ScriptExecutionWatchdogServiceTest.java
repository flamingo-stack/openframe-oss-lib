package com.openframe.client.service;

import com.openframe.client.metrics.ScriptExecutionWatchdogMetrics;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore.RetryState;
import com.openframe.client.service.rmm.watchdog.ScheduleJobExecutionWatchdogService;
import com.openframe.client.service.rmm.watchdog.ScriptExecutionWatchdogService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.repository.device.MachineRepository;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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

    @Mock
    private com.openframe.client.service.rmm.ScriptDeliveryRetryStore retryStore;

    @Mock
    private com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher scriptScheduleNatsPublisher;

    @Mock
    private MachineRepository machineRepository;

    private ScriptExecutionWatchdogService service;

    @BeforeEach
    void setUp() {
        service = new ScriptExecutionWatchdogService(repository, headerWatchdogService,
                new ScriptExecutionWatchdogMetrics(new SimpleMeterRegistry()), retryStore, scriptScheduleNatsPublisher,
                machineRepository);
        ReflectionTestUtils.setField(service, "graceSeconds", GRACE);
        ReflectionTestUtils.setField(service, "fallbackThresholdSeconds", FALLBACK);
        ReflectionTestUtils.setField(service, "retrySize", 3);
        ReflectionTestUtils.setField(service, "queuedThresholdSeconds", 30L);
        // Default: no target is offline. Individual QUEUED tests override as needed.
        lenient().when(machineRepository.findByMachineIdInAndStatus(any(), eq(DeviceStatus.OFFLINE)))
                .thenReturn(List.of());
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
    @DisplayName("reaping SCHEDULE leaves finalizes each distinct fire header once; ad-hoc (scheduleId=null) leaves trigger no header finalize")
    void reapedScheduleLeaves_finalizeHeaderOncePerFire() {
        ScriptExecution fireLeafA = scheduleLeaf("t-1", "sch-1", "exec-1", "m-1", 200);
        ScriptExecution fireLeafB = scheduleLeaf("t-1", "sch-1", "exec-1", "m-2", 200);  // same fire, other machine
        ScriptExecution adhoc = running(60, 200);                                        // scheduleId == null
        when(repository.findByStatusAndDispatchedAtBefore(any(), any()))
                .thenReturn(List.of(fireLeafA, fireLeafB, adhoc));

        service.markStuckExecutionsAsFailed();

        verify(repository).saveAll(any());
        // (t-1, exec-1) collapses to a single finalize; the ad-hoc leaf produces none.
        verify(headerWatchdogService).finalizeIfSettled("t-1", "exec-1");
        verifyNoMoreInteractions(headerWatchdogService);
    }

    @Test
    @DisplayName("no stuck rows → no header finalize attempts")
    void noStuck_noHeaderFinalize() {
        when(repository.findByStatusAndDispatchedAtBefore(any(), any())).thenReturn(List.of());

        service.markStuckExecutionsAsFailed();

        verifyNoInteractions(headerWatchdogService);
    }

    @Test
    @DisplayName("QUEUED retry: a stuck leaf within budget re-sends the stored message and increments — not failed")
    void queuedRetry_withinBudget_resends() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a", 60);
        ScriptScheduleExecutionMessage msg = ScriptScheduleExecutionMessage.builder().executionId("exec-1").machineId("m-1").build();
        when(repository.findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.QUEUED), any())).thenReturn(List.of(q));
        when(retryStore.get("exec-1", "m-1")).thenReturn(Optional.of(new RetryState(1, msg)));

        service.retryStuckQueuedDeliveries();

        verify(scriptScheduleNatsPublisher).publish(eq("m-1"), eq(msg));
        verify(retryStore).incrementRetryCount(eq("exec-1"), eq("m-1"), any());
        verify(repository, never()).saveAll(any());
    }

    @Test
    @DisplayName("QUEUED retry: budget exhausted → leaves FAILED, retry state evicted, header finalized")
    void queuedRetry_exhausted_fails() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a", 60);
        q.setScheduleId("sch-1");
        when(repository.findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.QUEUED), any())).thenReturn(List.of(q));
        when(retryStore.get("exec-1", "m-1"))
                .thenReturn(Optional.of(new RetryState(3, ScriptScheduleExecutionMessage.builder().build())));

        service.retryStuckQueuedDeliveries();

        verify(scriptScheduleNatsPublisher, never()).publish(any(), any());
        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).allMatch(r -> r.getStatus() == ExecutionStatus.FAILED);
        assertThat(captor.getValue()).allMatch(r -> r.getError() != null && r.getError().contains("could not receive"));
        verify(retryStore).evict("exec-1", "m-1");
        verify(headerWatchdogService).finalizeIfSettled("t-1", "exec-1");
    }

    @Test
    @DisplayName("QUEUED retry: no stored payload (Redis gone / expired) → FAILED + evict")
    void queuedRetry_noPayload_fails() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a", 60);
        when(repository.findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.QUEUED), any())).thenReturn(List.of(q));
        when(retryStore.get("exec-1", "m-1")).thenReturn(Optional.empty());

        service.retryStuckQueuedDeliveries();

        verify(scriptScheduleNatsPublisher, never()).publish(any(), any());
        verify(repository).saveAll(any());
        verify(retryStore).evict("exec-1", "m-1");
    }

    @Test
    @DisplayName("QUEUED retry: two leaves on one (executionId, machineId) collapse to a single re-send")
    void queuedRetry_groupsByDelivery() {
        ScriptScheduleExecutionMessage msg = ScriptScheduleExecutionMessage.builder().build();
        when(repository.findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(queued("exec-1", "m-1", "s-a", 60), queued("exec-1", "m-1", "s-b", 60)));
        when(retryStore.get("exec-1", "m-1")).thenReturn(Optional.of(new RetryState(0, msg)));

        service.retryStuckQueuedDeliveries();

        verify(scriptScheduleNatsPublisher, times(1)).publish(eq("m-1"), eq(msg));
    }

    @Test
    @DisplayName("QUEUED retry: an OFFLINE target is failed immediately — no re-send, retry store untouched, header finalized")
    void queuedRetry_offlineDevice_failsWithoutRetry() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a", 60);
        q.setScheduleId("sch-1");
        when(repository.findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.QUEUED), any())).thenReturn(List.of(q));
        when(machineRepository.findByMachineIdInAndStatus(any(), eq(DeviceStatus.OFFLINE)))
                .thenReturn(List.of(machine("m-1")));

        service.retryStuckQueuedDeliveries();

        verify(scriptScheduleNatsPublisher, never()).publish(any(), any());
        verify(retryStore, never()).get(any(), any());
        verify(retryStore, never()).incrementRetryCount(any(), any(), any());
        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).allMatch(r -> r.getStatus() == ExecutionStatus.FAILED);
        assertThat(captor.getValue()).allMatch(r -> r.getError() != null && r.getError().contains("offline"));
        verify(retryStore).evict("exec-1", "m-1");
        verify(headerWatchdogService).finalizeIfSettled("t-1", "exec-1");
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return machine;
    }

    private static ScriptExecution queued(String executionId, String machineId, String scriptId, long ageSeconds) {
        return ScriptExecution.builder()
                .id("q-" + executionId + "-" + scriptId)
                .tenantId("t-1")
                .executionId(executionId)
                .machineId(machineId)
                .scriptId(scriptId)
                .status(ExecutionStatus.QUEUED)
                .dispatchedAt(Instant.now().minusSeconds(ageSeconds))
                .build();
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
