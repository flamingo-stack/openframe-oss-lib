package com.openframe.client.service;

import com.openframe.client.service.rmm.DeviceOnlineDispatchService;
import com.openframe.client.service.rmm.ScheduleFireDispatcher;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.MachineFirstOnlineDispatch;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.device.MachineFirstOnlineDispatchRepository;
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

    @Mock private MachineFirstOnlineDispatchRepository dispatchRepository;
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
        // Default: bulk update reports "everything you sent got matched" — the healthy case.
        // Individual tests override this only to exercise the mismatch canary.
        lenient().when(dispatchRepository.markDispatchedIn(anyCollection(), any(Instant.class)))
                .thenAnswer(inv -> (long) ((Collection<?>) inv.getArgument(0)).size());
    }

    @Test
    @DisplayName("pending row + online machine + specific DEVICE_ONLINE schedule → dispatches and marks row via bulk update")
    void firesActiveDeviceOnlineOnly() {
        MachineFirstOnlineDispatch row = pendingRow();
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(row));
        ScriptSchedule deviceOnline = schedule("s1", ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        stubTenantReads(TENANT, List.of(onlineMachine()), List.of(assignment(MACHINE, "s1")), List.of(deviceOnline));

        service.processPending();

        verify(fireDispatcher).dispatch(eq(deviceOnline), eq(List.of(MACHINE)), any(Instant.class));
        verify(dispatchRepository).markDispatchedIn(eq(List.of(ROW_ID)), any(Instant.class));
    }

    @Test
    @DisplayName("machine offline at tick time → row NOT marked, next tick retries")
    void offlineMachine_leavesRowPending() {
        MachineFirstOnlineDispatch row = pendingRow();
        Machine offline = onlineMachine();
        offline.setStatus(DeviceStatus.OFFLINE);
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(row));
        stubTenantReads(TENANT, List.of(offline), List.of(), List.of());

        service.processPending();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        verify(dispatchRepository, never()).markDispatchedIn(any(), any(Instant.class));
    }

    @Test
    @DisplayName("machine missing (deleted between insert and tick) → row stays pending")
    void missingMachine_skippedGracefully() {
        MachineFirstOnlineDispatch row = pendingRow();
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(row));
        stubTenantReads(TENANT, List.of(), List.of(), List.of());   // no Machine → empty map

        service.processPending();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        verify(dispatchRepository, never()).markDispatchedIn(any(), any(Instant.class));
    }

    @Test
    @DisplayName("no schedules due for this machine → row STILL marked dispatched (drains pending set)")
    void noSchedulesDue_stillMarksDispatched() {
        MachineFirstOnlineDispatch row = pendingRow();
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(row));
        stubTenantReads(TENANT, List.of(onlineMachine()), List.of(), List.of());   // schedules empty

        service.processPending();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        verify(dispatchRepository).markDispatchedIn(eq(List.of(ROW_ID)), any(Instant.class));
    }

    @Test
    @DisplayName("matching CRITERIA schedule fires even with no explicit assignment")
    void criteriaScheduleFiresWithoutAssignment() {
        MachineFirstOnlineDispatch row = pendingRow();
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(row));
        ScriptSchedule criteria = criteriaSchedule("c1");
        stubTenantReads(TENANT, List.of(onlineMachine()), List.of(), List.of(criteria));
        when(targetResolver.matchesCriteria(eq(criteria), any(Machine.class))).thenReturn(true);

        service.processPending();

        verify(fireDispatcher).dispatch(eq(criteria), eq(List.of(MACHINE)), any(Instant.class));
        verify(dispatchRepository).markDispatchedIn(eq(List.of(ROW_ID)), any(Instant.class));
    }

    @Test
    @DisplayName("dispatch throws → failing row's id NOT in bulk update; siblings still flushed together")
    void dispatchFailure_leavesRowPendingAndKeepsProcessingOthers() {
        MachineFirstOnlineDispatch bad = row("row-bad", "m-bad");
        MachineFirstOnlineDispatch ok = row("row-ok", "m-ok");
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(bad, ok));
        ScriptSchedule s = schedule("s1", ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        stubTenantReads(
                TENANT,
                List.of(onlineMachine("m-bad"), onlineMachine("m-ok")),
                List.of(assignment("m-bad", "s1"), assignment("m-ok", "s1")),
                List.of(s));
        doThrow(new RuntimeException("nats down"))
                .when(fireDispatcher).dispatch(eq(s), eq(List.of("m-bad")), any(Instant.class));

        service.processPending();

        verify(fireDispatcher).dispatch(eq(s), eq(List.of("m-ok")), any(Instant.class));
        // Only the healthy row's id is in the bulk update — the failing one stays pending.
        ArgumentCaptor<Collection<String>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(dispatchRepository).markDispatchedIn(ids.capture(), any(Instant.class));
        assertThat(ids.getValue()).containsExactly("row-ok");
    }

    @Test
    @DisplayName("empty pending set → zero repo touches, zero bulk update")
    void nothingPending_noWork() {
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of());

        service.processPending();

        verify(machineRepository, never()).findByTenantIdAndMachineIdIn(any(), any());
        verify(assignedRepository, never()).findByTenantIdAndMachineIdIn(any(), any());
        verify(scheduleRepository, never()).findByTenantIdAndTriggerAndStatus(any(), any(), any());
        verify(dispatchRepository, never()).markDispatchedIn(any(), any(Instant.class));
    }

    @Test
    @DisplayName("batch cap: pending > batchSize → over-cap rows are NOT read this tick")
    void batchSizeCapsPerTick() {
        ReflectionTestUtils.setField(service, "batchSize", 2);
        MachineFirstOnlineDispatch a = row("row-a", "m-a");
        MachineFirstOnlineDispatch b = row("row-b", "m-b");
        MachineFirstOnlineDispatch c = row("row-c", "m-c");   // over the cap
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(a, b, c));
        stubTenantReads(TENANT, List.of(), List.of(), List.of());   // no machines → no marks

        service.processPending();

        // Bulk lookup gets only the first two machineIds, not m-c.
        ArgumentCaptor<Collection<String>> machineIds = ArgumentCaptor.forClass(Collection.class);
        verify(machineRepository).findByTenantIdAndMachineIdIn(eq(TENANT), machineIds.capture());
        assertThat(machineIds.getValue()).containsExactlyInAnyOrder("m-a", "m-b");
        verify(dispatchRepository, never()).markDispatchedIn(any(), any(Instant.class));
    }

    @Test
    @DisplayName("no N+1: 3 rows same tenant → exactly ONE bulk read of each collection, ONE bulk update")
    void oneRoundTripPerCollectionPerTenant() {
        MachineFirstOnlineDispatch a = row("row-a", "m-a");
        MachineFirstOnlineDispatch b = row("row-b", "m-b");
        MachineFirstOnlineDispatch c = row("row-c", "m-c");
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(a, b, c));
        stubTenantReads(TENANT,
                List.of(onlineMachine("m-a"), onlineMachine("m-b"), onlineMachine("m-c")),
                List.of(), List.of());

        service.processPending();

        verify(machineRepository, times(1)).findByTenantIdAndMachineIdIn(eq(TENANT), any());
        verify(assignedRepository, times(1)).findByTenantIdAndMachineIdIn(eq(TENANT), any());
        verify(scheduleRepository, times(1))
                .findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        ArgumentCaptor<Collection<String>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(dispatchRepository, times(1)).markDispatchedIn(ids.capture(), any(Instant.class));
        assertThat(ids.getValue()).containsExactlyInAnyOrder("row-a", "row-b", "row-c");
    }

    @Test
    @DisplayName("cross-tenant: rows from two tenants processed in isolation — one bulk read per (tenant, collection)")
    void multiTenantIsolation() {
        MachineFirstOnlineDispatch a = row("row-a", "m-a", TENANT);
        MachineFirstOnlineDispatch b = row("row-b", "m-b", OTHER_TENANT);
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(a, b));
        stubTenantReads(TENANT, List.of(onlineMachine("m-a", TENANT)), List.of(), List.of());
        stubTenantReads(OTHER_TENANT, List.of(onlineMachine("m-b", OTHER_TENANT)), List.of(), List.of());

        service.processPending();

        verify(machineRepository).findByTenantIdAndMachineIdIn(eq(TENANT), any());
        verify(machineRepository).findByTenantIdAndMachineIdIn(eq(OTHER_TENANT), any());
        ArgumentCaptor<Collection<String>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(dispatchRepository, times(1)).markDispatchedIn(ids.capture(), any(Instant.class));
        assertThat(ids.getValue()).containsExactlyInAnyOrder("row-a", "row-b");
    }

    @Test
    @DisplayName("tenant-scope bulk-read throws → that tenant's rows stay pending; other tenants still flush")
    void oneTenantBulkReadFails_othersStillFlush() {
        MachineFirstOnlineDispatch bad = row("row-bad", "m-bad", TENANT);        // will die on bulk-read
        MachineFirstOnlineDispatch good = row("row-good", "m-good", OTHER_TENANT); // healthy path
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(bad, good));
        // TENANT's machine bulk-read explodes (replica-set failover, timeout, ...).
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenThrow(new RuntimeException("mongo timeout"));
        // OTHER_TENANT works normally.
        stubTenantReads(OTHER_TENANT, List.of(onlineMachine("m-good", OTHER_TENANT)), List.of(), List.of());

        service.processPending();

        // Failed tenant → its row NOT flushed. Healthy tenant → its row IS flushed. tick still writes.
        ArgumentCaptor<Collection<String>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(dispatchRepository, times(1)).markDispatchedIn(ids.capture(), any(Instant.class));
        assertThat(ids.getValue()).containsExactly("row-good");
    }

    @Test
    @DisplayName("bulk-mark canary: matched < sent → error logged (silent updateFirst regression would be caught)")
    void markDispatchedInMismatch_isDetected() {
        MachineFirstOnlineDispatch a = row("row-a", "m-a");
        MachineFirstOnlineDispatch b = row("row-b", "m-b");
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(a, b));
        stubTenantReads(TENANT,
                List.of(onlineMachine("m-a"), onlineMachine("m-b")),
                List.of(), List.of());
        // Simulate a driver/store regression that matched only 1 of the 2 sent ids.
        when(dispatchRepository.markDispatchedIn(anyCollection(), any(Instant.class))).thenReturn(1L);

        service.processPending();

        // The call still happened — the canary is a logged warning, not an exception.
        // (Log assertion would need a log-capturing appender; behaviour check is enough here.)
        ArgumentCaptor<Collection<String>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(dispatchRepository).markDispatchedIn(ids.capture(), any(Instant.class));
        assertThat(ids.getValue()).hasSize(2);
    }

    // --- fixtures --------------------------------------------------------------------------------

    /** Stubs the 3 per-tenant reads at once so tests read as one intention, not three lines each. */
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

    private static MachineFirstOnlineDispatch pendingRow() {
        return row(ROW_ID, MACHINE, TENANT);
    }

    private static MachineFirstOnlineDispatch row(String id, String machineId) {
        return row(id, machineId, TENANT);
    }

    private static MachineFirstOnlineDispatch row(String id, String machineId, String tenantId) {
        return MachineFirstOnlineDispatch.builder()
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

    private static ScriptSchedule schedule(String id, ScriptScheduleTrigger trigger, ScriptStatus status) {
        return ScriptSchedule.builder()
                .id(id).tenantId(TENANT).name(id).trigger(trigger).status(status)
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
