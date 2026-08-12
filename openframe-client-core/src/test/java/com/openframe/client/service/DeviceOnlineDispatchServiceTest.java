package com.openframe.client.service;

import com.openframe.client.service.rmm.DeviceOnlineDispatchService;
import com.openframe.client.service.rmm.ScheduleFireDispatcher;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineDispatchServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String OTHER_TENANT = "tenant-2";
    private static final String MACHINE = "m-1";
    private static final String ROW_ID = "row-1";

    @Mock private DeviceOnlineDispatchRepository dispatchRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private ScheduleDeviceTargetResolver targetResolver;
    @Mock private ScheduleFireDispatcher fireDispatcher;

    @InjectMocks private DeviceOnlineDispatchService service;

    @BeforeEach
    void setUp() {
        // @Value fields don't get populated by @InjectMocks — set explicitly.
        ReflectionTestUtils.setField(service, "batchSize", 500);
        // Default: bulk update reports "everything you sent got modified" — the healthy case.
        lenient().when(dispatchRepository.markDispatchedIn(anyCollection(), any(Instant.class), any(DeviceOnlineDispatchStatus.class)))
                .thenAnswer(inv -> (long) ((Collection<?>) inv.getArgument(0)).size());
    }

    @Test
    @DisplayName("pending row + online machine + assigned DEVICE_ONLINE schedule → dispatched, bulk-marked")
    void firesActiveDeviceOnlineOnly() {
        DeviceFirstOnlineDispatch row = pendingRow();
        ScriptSchedule s = schedule("s1");
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(row));
        stubTenantReads(TENANT, List.of(onlineMachine()), List.of(assignment(MACHINE, "s1")), List.of(s));

        service.processDevicesBecameOnline();

        verify(fireDispatcher).dispatch(eq(s), eq(List.of(MACHINE)), any(Instant.class));
        verify(dispatchRepository).markDispatchedIn(eq(List.of(ROW_ID)), any(Instant.class), eq(DeviceOnlineDispatchStatus.DISPATCHED));
    }

    @Test
    @DisplayName("machine offline at tick → skipped, row stays pending")
    void offlineMachine_leavesRowPending() {
        DeviceFirstOnlineDispatch row = pendingRow();
        Machine offline = onlineMachine();
        offline.setStatus(DeviceStatus.OFFLINE);
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(row));
        stubTenantReads(TENANT, List.of(offline), List.of(), List.of());

        service.processDevicesBecameOnline();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        verify(dispatchRepository, never()).markDispatchedIn(any(), any(Instant.class), any());
    }

    @Test
    @DisplayName("machine missing → skipped, row stays pending")
    void missingMachine_leavesRowPending() {
        DeviceFirstOnlineDispatch row = pendingRow();
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(row));
        stubTenantReads(TENANT, List.of(), List.of(), List.of());

        service.processDevicesBecameOnline();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        verify(dispatchRepository, never()).markDispatchedIn(any(), any(Instant.class), any());
    }

    @Test
    @DisplayName("no schedules due → row STILL bulk-marked (drains pending set)")
    void noSchedulesDue_stillMarksDispatched() {
        DeviceFirstOnlineDispatch row = pendingRow();
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(row));
        stubTenantReads(TENANT, List.of(onlineMachine()), List.of(), List.of());

        service.processDevicesBecameOnline();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        verify(dispatchRepository).markDispatchedIn(eq(List.of(ROW_ID)), any(Instant.class), eq(DeviceOnlineDispatchStatus.DISPATCHED));
    }

    @Test
    @DisplayName("matching CRITERIA schedule fires without explicit assignment")
    void criteriaScheduleFiresWithoutAssignment() {
        DeviceFirstOnlineDispatch row = pendingRow();
        ScriptSchedule criteria = criteriaSchedule("c1");
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(row));
        stubTenantReads(TENANT, List.of(onlineMachine()), List.of(), List.of(criteria));
        when(targetResolver.matchesCriteria(eq(criteria), any(Machine.class))).thenReturn(true);

        service.processDevicesBecameOnline();

        verify(fireDispatcher).dispatch(eq(criteria), eq(List.of(MACHINE)), any(Instant.class));
        verify(dispatchRepository).markDispatchedIn(eq(List.of(ROW_ID)), any(Instant.class), eq(DeviceOnlineDispatchStatus.DISPATCHED));
    }

    @Test
    @DisplayName("per-row dispatch throws → failing row NOT in bulk-mark; siblings flushed")
    void dispatchFailure_leavesRowPendingAndKeepsProcessingOthers() {
        DeviceFirstOnlineDispatch bad = row("row-bad", "m-bad");
        DeviceFirstOnlineDispatch ok = row("row-ok", "m-ok");
        ScriptSchedule s = schedule("s1");
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(bad, ok));
        stubTenantReads(TENANT,
                List.of(onlineMachine("m-bad"), onlineMachine("m-ok")),
                List.of(assignment("m-bad", "s1"), assignment("m-ok", "s1")),
                List.of(s));
        doThrow(new RuntimeException("nats down"))
                .when(fireDispatcher).dispatch(eq(s), eq(List.of("m-bad")), any(Instant.class));

        service.processDevicesBecameOnline();

        verify(fireDispatcher).dispatch(eq(s), eq(List.of("m-ok")), any(Instant.class));
        ArgumentCaptor<Collection<String>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(dispatchRepository).markDispatchedIn(ids.capture(), any(Instant.class), any(DeviceOnlineDispatchStatus.class));
        assertThat(ids.getValue()).containsExactly("row-ok");
    }

    @Test
    @DisplayName("empty pending set → no work")
    void nothingPending_noWork() {
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of());

        service.processDevicesBecameOnline();

        verify(machineRepository, never()).findByTenantIdAndMachineIdIn(any(), any());
        verify(dispatchRepository, never()).markDispatchedIn(any(), any(Instant.class), any());
    }

    @Test
    @DisplayName("batch cap: the pending query is bounded at the DB by batchSize, ordered oldest-first")
    void batchSizeCapsPerTick_boundedAtDb() {
        ReflectionTestUtils.setField(service, "batchSize", 2);
        DeviceFirstOnlineDispatch a = row("row-a", "m-a");
        DeviceFirstOnlineDispatch b = row("row-b", "m-b");
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(a, b));
        stubTenantReads(TENANT, List.of(), List.of(), List.of());

        service.processDevicesBecameOnline();

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(dispatchRepository).findByStatus(eq(DeviceOnlineDispatchStatus.NEW), pageable.capture());
        assertThat(pageable.getValue().getPageSize()).isEqualTo(2);
        assertThat(pageable.getValue().getSort()).isEqualTo(Sort.by(Sort.Direction.ASC, "firstSeenAt"));

        ArgumentCaptor<Collection<String>> machineIds = ArgumentCaptor.forClass(Collection.class);
        verify(machineRepository).findByTenantIdAndMachineIdIn(eq(TENANT), machineIds.capture());
        assertThat(machineIds.getValue()).containsExactlyInAnyOrder("m-a", "m-b");
    }

    @Test
    @DisplayName("no N+1: 3 rows same tenant → ONE bulk read per collection, ONE bulk mark")
    void oneRoundTripPerCollectionPerTenant() {
        DeviceFirstOnlineDispatch a = row("row-a", "m-a");
        DeviceFirstOnlineDispatch b = row("row-b", "m-b");
        DeviceFirstOnlineDispatch c = row("row-c", "m-c");
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(a, b, c));
        stubTenantReads(TENANT,
                List.of(onlineMachine("m-a"), onlineMachine("m-b"), onlineMachine("m-c")),
                List.of(), List.of());

        service.processDevicesBecameOnline();

        verify(machineRepository, times(1)).findByTenantIdAndMachineIdIn(eq(TENANT), any());
        verify(assignedRepository, times(1)).findByTenantIdAndMachineIdIn(eq(TENANT), any());
        verify(scheduleRepository, times(1))
                .findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        ArgumentCaptor<Collection<String>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(dispatchRepository, times(1)).markDispatchedIn(ids.capture(), any(Instant.class), any(DeviceOnlineDispatchStatus.class));
        assertThat(ids.getValue()).containsExactlyInAnyOrder("row-a", "row-b", "row-c");
    }

    @Test
    @DisplayName("cross-tenant: 2 tenants → bulk reads per tenant, ONE global bulk-mark")
    void multiTenantIsolation() {
        DeviceFirstOnlineDispatch a = row("row-a", "m-a", TENANT);
        DeviceFirstOnlineDispatch b = row("row-b", "m-b", OTHER_TENANT);
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(a, b));
        stubTenantReads(TENANT, List.of(onlineMachine("m-a", TENANT)), List.of(), List.of());
        stubTenantReads(OTHER_TENANT, List.of(onlineMachine("m-b", OTHER_TENANT)), List.of(), List.of());

        service.processDevicesBecameOnline();

        verify(machineRepository).findByTenantIdAndMachineIdIn(eq(TENANT), any());
        verify(machineRepository).findByTenantIdAndMachineIdIn(eq(OTHER_TENANT), any());
        ArgumentCaptor<Collection<String>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(dispatchRepository, times(1)).markDispatchedIn(ids.capture(), any(Instant.class), any(DeviceOnlineDispatchStatus.class));
        assertThat(ids.getValue()).containsExactlyInAnyOrder("row-a", "row-b");
    }

    // --- fixtures --------------------------------------------------------------------------------

    private void stubTenantReads(String tenantId,
                                 List<Machine> machines,
                                 List<ScriptScheduleMachineAssigned> assignments,
                                 List<ScriptSchedule> tenantSchedules) {
        lenient().when(machineRepository.findByTenantIdAndMachineIdIn(eq(tenantId), any()))
                .thenReturn(machines);
        lenient().when(assignedRepository.findByTenantIdAndMachineIdIn(eq(tenantId), any()))
                .thenReturn(assignments);
        lenient().when(scheduleRepository.findByTenantIdAndTriggerAndStatus(
                        tenantId, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                .thenReturn(tenantSchedules);
    }

    private static DeviceFirstOnlineDispatch pendingRow() {
        return row(ROW_ID, MACHINE, TENANT);
    }

    private static DeviceFirstOnlineDispatch row(String id, String machineId) {
        return row(id, machineId, TENANT);
    }

    private static DeviceFirstOnlineDispatch row(String id, String machineId, String tenantId) {
        return DeviceFirstOnlineDispatch.builder()
                .id(id).tenantId(tenantId).machineId(machineId).firstSeenAt(Instant.now()).build();
    }

    private static Machine onlineMachine() {
        return onlineMachine(MACHINE, TENANT);
    }

    private static Machine onlineMachine(String machineId) {
        return onlineMachine(machineId, TENANT);
    }

    private static Machine onlineMachine(String machineId, String tenantId) {
        Machine m = new Machine();
        m.setTenantId(tenantId);
        m.setMachineId(machineId);
        m.setStatus(DeviceStatus.ONLINE);
        return m;
    }

    private static ScriptScheduleMachineAssigned assignment(String machineId, String scheduleId) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT).scriptScheduleId(scheduleId).machineId(machineId).build();
    }

    private static ScriptSchedule schedule(String id) {
        return ScriptSchedule.builder()
                .id(id).tenantId(TENANT).name(id)
                .trigger(ScriptScheduleTrigger.DEVICE_ONLINE).status(ScriptStatus.ACTIVE)
                .scriptIds(List.of("sc")).build();
    }

    private static ScriptSchedule criteriaSchedule(String id) {
        return ScriptSchedule.builder()
                .id(id).tenantId(TENANT).name(id)
                .trigger(ScriptScheduleTrigger.DEVICE_ONLINE).status(ScriptStatus.ACTIVE)
                .selectionMode(ScheduleDeviceSelectionMode.CRITERIA)
                .scriptIds(List.of("sc")).build();
    }
}
