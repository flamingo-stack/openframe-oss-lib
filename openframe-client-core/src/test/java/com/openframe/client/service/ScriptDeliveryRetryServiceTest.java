package com.openframe.client.service;

import com.openframe.client.metrics.ScriptExecutionWatchdogMetrics;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore.RetryState;
import com.openframe.client.service.rmm.watchdog.DeliveryRepublisher;
import com.openframe.client.service.rmm.watchdog.DeliveryRepublisherRegistry;
import com.openframe.client.service.rmm.watchdog.ScheduleJobExecutionWatchdogService;
import com.openframe.client.service.rmm.watchdog.ScriptDeliveryRetryService;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.delivery.track.DeliveryTracker;
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

    private static final String SCHEDULE_JSON = "{\"executionId\":\"exec-1\",\"machineId\":\"m-1\"}";

    @Mock
    private ScriptExecutionRepository repository;

    @Mock
    private ScheduleJobExecutionWatchdogService headerWatchdogService;

    @Mock
    private ScriptDeliveryRetryStore retryStore;

    @Mock
    private DeliveryRepublisherRegistry deliveryRepublisherRegistry;

    @Mock
    private DeliveryRepublisher republisher;

    @Mock
    private MachineRepository machineRepository;
    @Mock
    private DeliveryTracker deliveryTracker;

    private ScriptDeliveryRetryService service;

    @BeforeEach
    void setUp() {
        service = new ScriptDeliveryRetryService(repository, headerWatchdogService,
                new ScriptExecutionWatchdogMetrics(new SimpleMeterRegistry()), retryStore, deliveryRepublisherRegistry,
                machineRepository, deliveryTracker);
        ReflectionTestUtils.setField(service, "retrySize", 3);
        ReflectionTestUtils.setField(service, "queuedThresholdSeconds", 30L);
        // Default: no target is offline; the SCHEDULE republisher is the one resolved. Tests override.
        lenient().when(machineRepository.findByMachineIdInAndStatus(any(), eq(DeviceStatus.OFFLINE)))
                .thenReturn(List.of());
        lenient().when(deliveryRepublisherRegistry.get(any())).thenReturn(republisher);
        // Default: the batch went the way before the engine, no row under its executionId. Tests override.
        lenient().when(deliveryTracker.find(eq(DeliveryType.SCRIPT_SCHEDULE), any(), any())).thenReturn(Optional.empty());
    }

    @Test
    @DisplayName("engine row still PENDING → the engine retries, nothing re-published or failed from here")
    void engineRowPending_leftToTheEngine() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
        when(repository.findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(q));
        when(deliveryTracker.find(DeliveryType.SCRIPT_SCHEDULE, "exec-1", "m-1"))
                .thenReturn(Optional.of(engineRow(DeliveryStatus.PENDING, null, 2)));
        service.retryStuckQueuedDeliveries();
        verify(republisher, never()).republish(any(), any());
        verify(retryStore, never()).get(any(), any());
        verify(repository, never()).saveAll(any());
        assertThat(q.getStatus()).isEqualTo(ExecutionStatus.QUEUED);
    }

    @Test
    @DisplayName("engine row FAILED after its attempts → leaves FAILED with the attempt count, retry state evicted, header finalized")
    void engineRowExhausted_fails() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
        q.setScheduleId("sch-1");
        when(repository.findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(q));
        when(deliveryTracker.find(DeliveryType.SCRIPT_SCHEDULE, "exec-1", "m-1"))
                .thenReturn(Optional.of(engineRow(DeliveryStatus.FAILED, DeliveryFailure.EXHAUSTED, 7)));
        service.retryStuckQueuedDeliveries();
        verify(republisher, never()).republish(any(), any());
        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).allMatch(r -> r.getStatus() == ExecutionStatus.FAILED);
        assertThat(captor.getValue()).allMatch(r -> r.getError().equals("Agent could not receive the script after 7 delivery attempt(s)"));
        verify(retryStore).evict("exec-1", "m-1");
        verify(headerWatchdogService).finalizeAffectedHeaders(captor.getValue());
    }

    @Test
    @DisplayName("engine row FAILED as OFFLINE → leaves FAILED with the offline text")
    void engineRowOffline_failsAsOffline() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
        when(repository.findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(q));
        when(deliveryTracker.find(DeliveryType.SCRIPT_SCHEDULE, "exec-1", "m-1"))
                .thenReturn(Optional.of(engineRow(DeliveryStatus.FAILED, DeliveryFailure.OFFLINE, 0)));
        service.retryStuckQueuedDeliveries();
        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).allMatch(r -> r.getError().contains("offline"));
    }

    @Test
    @DisplayName("engine row CANCELLED while the machine is OFFLINE → the offline text; otherwise the cancelled text")
    void engineRowCancelled_textByTheMachinesState() {
        ScriptExecution offline = queued("exec-1", "m-1", "s-a");
        ScriptExecution withdrawn = queued("exec-2", "m-2", "s-a");
        when(repository.findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(offline, withdrawn));
        when(machineRepository.findByMachineIdInAndStatus(any(), eq(DeviceStatus.OFFLINE)))
                .thenReturn(List.of(machine("m-1")));
        when(deliveryTracker.find(eq(DeliveryType.SCRIPT_SCHEDULE), any(), any()))
                .thenReturn(Optional.of(engineRow(DeliveryStatus.CANCELLED, null, 0)));
        service.retryStuckQueuedDeliveries();
        verify(republisher, never()).republish(any(), any());
        assertThat(offline.getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(offline.getError()).contains("offline");
        assertThat(withdrawn.getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(withdrawn.getError()).contains("cancelled");
    }

    @Test
    @DisplayName("engine row DONE with leaves still QUEUED (the ack closed the row, the leaves did not follow) → leaves RUNNING")
    void engineRowDone_leavesFollowToRunning() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
        when(repository.findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(q));
        when(deliveryTracker.find(DeliveryType.SCRIPT_SCHEDULE, "exec-1", "m-1"))
                .thenReturn(Optional.of(engineRow(DeliveryStatus.DONE, null, 1)));
        service.retryStuckQueuedDeliveries();
        ArgumentCaptor<List<ScriptExecution>> captor = listCaptor();
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(q);
        assertThat(q.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
        verify(retryStore).evict("exec-1", "m-1");
        verify(headerWatchdogService, never()).finalizeAffectedHeaders(any());
    }

    private static MachineDelivery engineRow(DeliveryStatus status, DeliveryFailure failure, int attempts) {
        MachineDelivery row = new MachineDelivery();
        row.setType(DeliveryType.SCRIPT_SCHEDULE);
        row.setStatus(status);
        row.setFailure(failure);
        row.setAttempts(attempts);
        return row;
    }

    @Test
    @DisplayName("within budget → re-publishes the stored message via the channel's republisher and increments, not failed")
    void withinBudget_resends() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
        when(repository.findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(q));
        when(retryStore.get("exec-1", "m-1")).thenReturn(Optional.of(new RetryState(1, DeliveryChannel.SCHEDULE, SCHEDULE_JSON)));

        service.retryStuckQueuedDeliveries();

        verify(deliveryRepublisherRegistry).get(DeliveryChannel.SCHEDULE);
        verify(republisher).republish("m-1", SCHEDULE_JSON);
        verify(retryStore).incrementRetryCount(eq("exec-1"), eq("m-1"), any());
        verify(repository, never()).saveAll(any());
    }

    @Test
    @DisplayName("budget exhausted → leaves FAILED, retry state evicted, header finalized, nothing re-published")
    void exhausted_fails() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
        q.setScheduleId("sch-1");
        when(repository.findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(q));
        when(retryStore.get("exec-1", "m-1"))
                .thenReturn(Optional.of(new RetryState(3, DeliveryChannel.SCHEDULE, SCHEDULE_JSON)));

        service.retryStuckQueuedDeliveries();

        verify(republisher, never()).republish(any(), any());
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
        when(repository.findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(q));
        when(retryStore.get("exec-1", "m-1")).thenReturn(Optional.empty());

        service.retryStuckQueuedDeliveries();

        verify(republisher, never()).republish(any(), any());
        verify(repository).saveAll(any());
        verify(retryStore).evict("exec-1", "m-1");
    }

    @Test
    @DisplayName("two leaves on one (executionId, machineId) collapse to a single re-publish")
    void groupsByDelivery() {
        when(repository.findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(queued("exec-1", "m-1", "s-a"), queued("exec-1", "m-1", "s-b")));
        when(retryStore.get("exec-1", "m-1")).thenReturn(Optional.of(new RetryState(0, DeliveryChannel.SCHEDULE, SCHEDULE_JSON)));

        service.retryStuckQueuedDeliveries();

        verify(republisher, times(1)).republish("m-1", SCHEDULE_JSON);
    }

    @Test
    @DisplayName("an OFFLINE target is failed immediately — no re-publish, retry store/registry untouched, header finalized")
    void offlineDevice_failsWithoutRetry() {
        ScriptExecution q = queued("exec-1", "m-1", "s-a");
        q.setScheduleId("sch-1");
        when(repository.findByStatusAndDispatchedAtBeforeAndPackageUpdateRequestIdIsNull(eq(ExecutionStatus.QUEUED), any()))
                .thenReturn(List.of(q));
        when(machineRepository.findByMachineIdInAndStatus(any(), eq(DeviceStatus.OFFLINE)))
                .thenReturn(List.of(machine("m-1")));

        service.retryStuckQueuedDeliveries();

        verify(republisher, never()).republish(any(), any());
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
