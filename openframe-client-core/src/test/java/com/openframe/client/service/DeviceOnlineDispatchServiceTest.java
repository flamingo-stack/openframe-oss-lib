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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineDispatchServiceTest {

    private static final String TENANT = "tenant-1";
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
    void setBatchSize() {
        // @Value fields don't get populated by @InjectMocks — set explicitly.
        ReflectionTestUtils.setField(service, "batchSize", 500);
    }

    @Test
    @DisplayName("pending row + online machine + specific DEVICE_ONLINE schedule → dispatches and marks row")
    void firesActiveDeviceOnlineOnly() {
        MachineFirstOnlineDispatch row = pendingRow();
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(row));
        when(machineRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.of(onlineMachine()));
        when(assignedRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                .thenReturn(List.of(assignment("s1"), assignment("s2"), assignment("s3")));
        ScriptSchedule deviceOnline = schedule("s1", ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        ScriptSchedule wrongTrigger = schedule("s2", ScriptScheduleTrigger.DATE_TIME, ScriptStatus.ACTIVE);
        ScriptSchedule archived = schedule("s3", ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ARCHIVED);
        when(scheduleRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(deviceOnline, wrongTrigger, archived));

        service.processPending();

        verify(fireDispatcher).dispatch(eq(deviceOnline), eq(List.of(MACHINE)), any(Instant.class));
        verify(fireDispatcher, never()).dispatch(eq(wrongTrigger), any(), any(Instant.class));
        verify(fireDispatcher, never()).dispatch(eq(archived), any(), any(Instant.class));
        verify(dispatchRepository).markDispatched(eq(ROW_ID), any(Instant.class));
    }

    @Test
    @DisplayName("machine offline at tick time → skipped, row stays PENDING (dispatchedAt NOT set), next tick retries")
    void offlineMachine_leavesRowPending() {
        MachineFirstOnlineDispatch row = pendingRow();
        Machine offline = onlineMachine();
        offline.setStatus(DeviceStatus.OFFLINE);
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(row));
        when(machineRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.of(offline));

        service.processPending();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        verify(dispatchRepository, never()).markDispatched(any(), any(Instant.class));
    }

    @Test
    @DisplayName("machine missing (deleted between insert and tick) → skipped, row stays pending (never dispatched, no crash)")
    void missingMachine_skippedGracefully() {
        MachineFirstOnlineDispatch row = pendingRow();
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(row));
        when(machineRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.empty());

        service.processPending();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        verify(dispatchRepository, never()).markDispatched(any(), any(Instant.class));
    }

    @Test
    @DisplayName("no schedules due for this machine → row STILL marked dispatched (drains pending set; a schedule assigned later has its own dispatch path)")
    void noSchedulesDue_stillMarksDispatched() {
        MachineFirstOnlineDispatch row = pendingRow();
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(row));
        when(machineRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.of(onlineMachine()));
        when(assignedRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(List.of());
        when(scheduleRepository.findByTenantIdAndSelectionModeAndTriggerAndStatus(
                TENANT, ScheduleDeviceSelectionMode.CRITERIA,
                ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE)).thenReturn(List.of());

        service.processPending();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        verify(dispatchRepository).markDispatched(eq(ROW_ID), any(Instant.class));
    }

    @Test
    @DisplayName("matching CRITERIA schedule fires even with no explicit assignment")
    void criteriaScheduleFiresWithoutAssignment() {
        MachineFirstOnlineDispatch row = pendingRow();
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(row));
        when(machineRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.of(onlineMachine()));
        when(assignedRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(List.of());
        ScriptSchedule criteria = criteriaSchedule("c1");
        when(scheduleRepository.findByTenantIdAndSelectionModeAndTriggerAndStatus(
                TENANT, ScheduleDeviceSelectionMode.CRITERIA,
                ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE)).thenReturn(List.of(criteria));
        when(targetResolver.matchesCriteria(eq(criteria), any(Machine.class))).thenReturn(true);

        service.processPending();

        verify(fireDispatcher).dispatch(eq(criteria), eq(List.of(MACHINE)), any(Instant.class));
        verify(dispatchRepository).markDispatched(eq(ROW_ID), any(Instant.class));
    }

    @Test
    @DisplayName("dispatch throws mid-way → row stays PENDING (retry on next tick), other pending rows continue processing")
    void dispatchFailure_leavesRowPendingAndKeepsProcessingOthers() {
        MachineFirstOnlineDispatch bad = row("row-bad", "m-bad");
        MachineFirstOnlineDispatch ok = row("row-ok", "m-ok");
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(bad, ok));
        when(machineRepository.findByTenantIdAndMachineId(TENANT, "m-bad")).thenReturn(Optional.of(onlineMachine("m-bad")));
        when(machineRepository.findByTenantIdAndMachineId(TENANT, "m-ok")).thenReturn(Optional.of(onlineMachine("m-ok")));
        // Both machines assigned to the same DEVICE_ONLINE schedule; dispatch throws only for m-bad.
        lenient().when(assignedRepository.findByTenantIdAndMachineId(eq(TENANT), any()))
                .thenReturn(List.of(assignment("s1")));
        ScriptSchedule s = schedule("s1", ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        lenient().when(scheduleRepository.findByTenantIdAndIdIn(eq(TENANT), any())).thenReturn(List.of(s));
        doThrow(new RuntimeException("nats down"))
                .when(fireDispatcher).dispatch(eq(s), eq(List.of("m-bad")), any(Instant.class));

        service.processPending();

        // bad: dispatch failed → NOT marked, will retry next tick
        verify(dispatchRepository, never()).markDispatched(eq("row-bad"), any(Instant.class));
        // ok: fired and marked
        verify(fireDispatcher).dispatch(eq(s), eq(List.of("m-ok")), any(Instant.class));
        verify(dispatchRepository).markDispatched(eq("row-ok"), any(Instant.class));
    }

    @Test
    @DisplayName("empty pending set → no work at all (no repo lookups, no dispatch)")
    void nothingPending_noWork() {
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of());

        service.processPending();

        verify(machineRepository, never()).findByTenantIdAndMachineId(any(), any());
        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        verify(dispatchRepository, never()).markDispatched(any(), any(Instant.class));
    }

    @Test
    @DisplayName("batch cap: pending set larger than batchSize → only first batchSize processed this tick")
    void batchSizeCapsPerTick() {
        ReflectionTestUtils.setField(service, "batchSize", 2);
        MachineFirstOnlineDispatch a = row("row-a", "m-a");
        MachineFirstOnlineDispatch b = row("row-b", "m-b");
        MachineFirstOnlineDispatch c = row("row-c", "m-c");   // over the cap — must NOT be touched this tick
        when(dispatchRepository.findByDispatchedAtIsNull()).thenReturn(List.of(a, b, c));
        lenient().when(machineRepository.findByTenantIdAndMachineId(any(), any())).thenReturn(Optional.empty());   // skip -> no fire, no mark

        service.processPending();

        verify(machineRepository).findByTenantIdAndMachineId(TENANT, "m-a");
        verify(machineRepository).findByTenantIdAndMachineId(TENANT, "m-b");
        verify(machineRepository, never()).findByTenantIdAndMachineId(TENANT, "m-c");
    }

    private static MachineFirstOnlineDispatch pendingRow() {
        return row(ROW_ID, MACHINE);
    }

    private static MachineFirstOnlineDispatch row(String id, String machineId) {
        return MachineFirstOnlineDispatch.builder()
                .id(id).tenantId(TENANT).machineId(machineId).firstSeenAt(Instant.now()).build();
    }

    private static Machine onlineMachine() {
        return onlineMachine(MACHINE);
    }

    private static Machine onlineMachine(String machineId) {
        Machine m = new Machine();
        m.setTenantId(TENANT);
        m.setMachineId(machineId);
        m.setStatus(DeviceStatus.ONLINE);
        return m;
    }

    private static ScriptScheduleMachineAssigned assignment(String scheduleId) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT).scriptScheduleId(scheduleId).machineId(MACHINE).build();
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
