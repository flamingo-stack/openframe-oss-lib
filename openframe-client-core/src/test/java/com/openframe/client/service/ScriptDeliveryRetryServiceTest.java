package com.openframe.client.service;

import com.openframe.client.metrics.ScriptExecutionWatchdogMetrics;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore.RetryState;
import com.openframe.client.service.rmm.watchdog.ScheduleJobExecutionWatchdogService;
import com.openframe.client.service.rmm.watchdog.ScriptDeliveryRetryService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptDeliveryRetryServiceTest {

    @Mock
    private ScriptExecutionRepository repository;

    @Mock
    private ScheduleJobExecutionWatchdogService headerWatchdogService;

    @Mock
    private ScriptDeliveryRetryStore retryStore;

    @Mock
    private ScriptScheduleNatsPublisher scriptScheduleNatsPublisher;

    @Mock
    private MachineRepository machineRepository;

    private ScriptDeliveryRetryService service;

    @BeforeEach
    void setUp() {
        service = new ScriptDeliveryRetryService(repository, headerWatchdogService,
                new ScriptExecutionWatchdogMetrics(new SimpleMeterRegistry()), retryStore, scriptScheduleNatsPublisher,
                machineRepository);
        ReflectionTestUtils.setField(service, "retrySize", 3);
        ReflectionTestUtils.setField(service, "queuedThresholdSeconds", 30L);
        // Default: no target is offline. Individual tests override as needed.
        lenient().when(machineRepository.findByMachineIdInAndStatus(any(), eq(DeviceStatus.OFFLINE)))
                .thenReturn(List.of());
    }

    @Test
    @DisplayName("within budget → re-sends the stored message and increments, not failed")
    void withinBudget_resends() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
        ScriptScheduleExecutionMessage msg = ScriptScheduleExecutionMessage.builder().executionId("exec-1").machineId("m-1").build();
        when(repository.findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.QUEUED), any())).thenReturn(List.of(q));
        when(retryStore.get("exec-1", "m-1")).thenReturn(Optional.of(new RetryState(1, msg)));

        service.retryStuckQueuedDeliveries();

        verify(scriptScheduleNatsPublisher).publish(eq("m-1"), eq(msg));
        verify(retryStore).incrementRetryCount(eq("exec-1"), eq("m-1"), any());
        verify(repository, never()).saveAll(any());
    }

    @Test
    @DisplayName("budget exhausted → leaves FAILED, retry state evicted, header finalized")
    void exhausted_fails() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
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
        verify(headerWatchdogService).finalizeAffectedHeaders(captor.getValue());
    }

    @Test
    @DisplayName("no stored payload (retry entry gone / expired) → FAILED + evict")
    void noPayload_fails() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
        when(repository.findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.QUEUED), any())).thenReturn(List.of(q));
        when(retryStore.get("exec-1", "m-1")).thenReturn(Optional.empty());

        service.retryStuckQueuedDeliveries();

        verify(scriptScheduleNatsPublisher, never()).publish(any(), any());
        verify(repository).saveAll(any());
        verify(retryStore).evict("exec-1", "m-1");
    }

    @Test
    @DisplayName("two leaves on one (executionId, machineId) collapse to a single re-send")
    void groupsByDelivery() {
        ScriptScheduleExecutionMessage msg = ScriptScheduleExecutionMessage.builder().build();
        when(repository.findByStatusAndDispatchedAtBefore(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(queued("exec-1", "m-1", "s-a"), queued("exec-1", "m-1", "s-b")));
        when(retryStore.get("exec-1", "m-1")).thenReturn(Optional.of(new RetryState(0, msg)));

        service.retryStuckQueuedDeliveries();

        verify(scriptScheduleNatsPublisher, times(1)).publish(eq("m-1"), eq(msg));
    }

    @Test
    @DisplayName("an OFFLINE target is failed immediately — no re-send, retry store untouched, header finalized")
    void offlineDevice_failsWithoutRetry() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
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
        verify(headerWatchdogService).finalizeAffectedHeaders(captor.getValue());
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return machine;
    }

    private static ScriptExecution queued(String executionId, String machineId, String scriptId) {
        return ScriptExecution.builder()
                .id("q-" + executionId + "-" + scriptId)
                .tenantId("t-1")
                .executionId(executionId)
                .machineId(machineId)
                .scriptId(scriptId)
                .status(ExecutionStatus.QUEUED)
                .dispatchedAt(Instant.now().minusSeconds(60))
                .build();
    }

    @SuppressWarnings("unchecked")
    private static ArgumentCaptor<List<ScriptExecution>> listCaptor() {
        return ArgumentCaptor.forClass(List.class);
    }
}
