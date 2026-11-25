package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.repository.rmm.ScheduleDeviceLocalDispatchRepository;
import com.openframe.data.service.rmm.ScheduleCriteriaDeviceResolver;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareScheduleOnlineDispatchServiceTest {

    private static final String TENANT = "t1";
    private static final String SCHEDULE_ID = "ss-1";

    @Mock private SoftwareScheduleOnlineDispatchRepository dispatchRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private SoftwareScheduleRepository scheduleRepository;
    @Mock private SoftwareScheduleMachineAssignedRepository assignedRepository;
    @Mock private SoftwareScheduleFireDispatcher fireDispatcher;

    private SoftwareScheduleOnlineDispatchService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareScheduleOnlineDispatchService(dispatchRepository, machineRepository,
                scheduleRepository, new SoftwareScheduleTargetResolver(assignedRepository,
                new ScheduleCriteriaDeviceResolver(machineRepository), mock(PackageManagerAvailability.class),
                mock(ScheduleDeviceLocalDispatchRepository.class)), fireDispatcher);
        ReflectionTestUtils.setField(service, "batchSize", 500);
    }

    @Test
    @DisplayName("empty batch: nothing loaded or dispatched")
    void emptyBatch_noop() {
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of());

        service.processReconnectedDevices();

        verifyNoInteractions(machineRepository, scheduleRepository, fireDispatcher);
        verify(dispatchRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("reconnected device fires its schedule and is marked DISPATCHED; still-offline is left NEW; expired window is EXPIRED")
    void mixed_online_offline_expired() {
        Instant now = Instant.now();
        SoftwareScheduleOnlineDispatch online = sentinel("m-online", now.plusSeconds(3600));   // still in window
        SoftwareScheduleOnlineDispatch offline = sentinel("m-offline", now.plusSeconds(3600));  // still in window
        SoftwareScheduleOnlineDispatch expired = sentinel("m-expired", now.minusSeconds(10));   // window elapsed
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of(online, offline, expired));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-online", DeviceStatus.MANAGED, TelemetryStatus.ONLINE),
                        machine("m-offline", DeviceStatus.MANAGED, TelemetryStatus.OFFLINE),
                        machine("m-expired", DeviceStatus.MANAGED, TelemetryStatus.ONLINE)));
        SoftwareSchedule schedule = SoftwareSchedule.builder().id(SCHEDULE_ID).tenantId(TENANT).status(ScriptStatus.ACTIVE).build();
        when(machineRepository.findOnPrimaryByTenantIdAndMachineId(TENANT, "m-online"))
                .thenReturn(Optional.of(machine("m-online", DeviceStatus.MANAGED, TelemetryStatus.ONLINE)));
        when(scheduleRepository.findOnPrimaryByTenantIdAndIdAndStatus(TENANT, SCHEDULE_ID, ScriptStatus.ACTIVE))
                .thenReturn(Optional.of(schedule));
        when(assignedRepository.existsOnPrimaryByTenantIdAndSoftwareScheduleIdAndMachineId(TENANT, SCHEDULE_ID, "m-online"))
                .thenReturn(true);
        when(dispatchRepository.existsOnPrimaryByTenantIdAndIdAndStatus(TENANT, online.getId(), DeviceOnlineDispatchStatus.NEW))
                .thenReturn(true);

        service.processReconnectedDevices();

        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-online")), any());
        verify(fireDispatcher, never()).dispatch(eq(schedule), eq(List.of("m-offline")), any());

        verify(dispatchRepository).transitionIfNew(eq(TENANT), eq(online.getId()), eq(DeviceOnlineDispatchStatus.DISPATCHED), any());
        verify(dispatchRepository).transitionIfNew(eq(TENANT), eq(expired.getId()), eq(DeviceOnlineDispatchStatus.EXPIRED), isNull());
        verify(dispatchRepository, never()).transitionIfNew(eq(TENANT), eq(offline.getId()), any(), any());
    }

    @Test
    @DisplayName("online is decided by telemetryStatus: status MANAGED with telemetry OFFLINE is left NEW, nothing dispatched")
    void statusOnlineTelemetryOffline_leftNew() {
        // setup
        Instant now = Instant.now();
        SoftwareScheduleOnlineDispatch row = sentinel("m-stale", now.plusSeconds(3600));
        Machine staleStatus = machine("m-stale", DeviceStatus.MANAGED, TelemetryStatus.ONLINE);
        staleStatus.setTelemetryStatus(TelemetryStatus.OFFLINE);
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of(row));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any())).thenReturn(List.of(staleStatus));

        // execution
        service.processReconnectedDevices();

        // verifications
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).transitionIfNew(eq(TENANT), eq(row.getId()), any(), any());
    }

    @Test
    @DisplayName("D1: a PENDING device that is online is left NEW, nothing dispatched")
    void pendingMachineOnline_leftNew() {
        // setup
        Instant now = Instant.now();
        SoftwareScheduleOnlineDispatch row = sentinel("m-pending", now.plusSeconds(3600));
        Machine pending = machine("m-pending", DeviceStatus.PENDING, TelemetryStatus.OFFLINE);
        pending.setTelemetryStatus(TelemetryStatus.ONLINE);
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of(row));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any())).thenReturn(List.of(pending));

        // execution
        service.processReconnectedDevices();

        // verifications
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).transitionIfNew(eq(TENANT), eq(row.getId()), any(), any());
    }

    @Test
    void reinstalledDeviceWithoutCurrentAssignmentIsNotDispatched() {
        // setup
        SoftwareScheduleOnlineDispatch row = sentinel("m-reinstalled", Instant.now().plusSeconds(600));
        setOnlineScheduleAndPendingRow(row);

        // execution
        service.processReconnectedDevices();

        // verifications
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository).transitionIfNew(TENANT, row.getId(), DeviceOnlineDispatchStatus.EXPIRED, null);
    }

    @Test
    void reconnectRowRemovedAfterBatchReadIsNotDispatchedOrRecreated() {
        // setup
        SoftwareScheduleOnlineDispatch row = sentinel("m-reinstalled", Instant.now().plusSeconds(600));
        setOnlineScheduleAndPendingRow(row);
        when(assignedRepository.existsOnPrimaryByTenantIdAndSoftwareScheduleIdAndMachineId(
                TENANT, SCHEDULE_ID, row.getMachineId())).thenReturn(true);

        // execution
        service.processReconnectedDevices();

        // verifications
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).transitionIfNew(eq(TENANT), eq(row.getId()), any(), any());
        verify(dispatchRepository, never()).saveAll(any());
    }

    @Test
    void reconnectRespectsCurrentCriteria() {
        // setup
        SoftwareScheduleOnlineDispatch row = sentinel("m-reconnected", Instant.now().plusSeconds(600));
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of(row));
        Machine machine = machine(row.getMachineId(), DeviceStatus.MANAGED, TelemetryStatus.ONLINE);
        machine.setOrganizationId("different-organization");
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any())).thenReturn(List.of(machine));
        SoftwareSchedule schedule = SoftwareSchedule.builder().id(SCHEDULE_ID).tenantId(TENANT)
                .selectionMode(ScheduleDeviceSelectionMode.CRITERIA)
                .deviceCriteria(ScheduleDeviceCriteria.builder().organizationIds(List.of("selected-organization")).build())
                .build();
        when(machineRepository.findOnPrimaryByTenantIdAndMachineId(TENANT, row.getMachineId())).thenReturn(Optional.of(machine));
        when(scheduleRepository.findOnPrimaryByTenantIdAndIdAndStatus(TENANT, SCHEDULE_ID, ScriptStatus.ACTIVE))
                .thenReturn(Optional.of(schedule));

        // execution
        service.processReconnectedDevices();

        // verifications
        verifyNoInteractions(fireDispatcher);
    }

    private void setOnlineScheduleAndPendingRow(SoftwareScheduleOnlineDispatch row) {
        Machine machine = machine(row.getMachineId(), DeviceStatus.MANAGED, TelemetryStatus.ONLINE);
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of(row));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineId(TENANT, row.getMachineId())).thenReturn(Optional.of(machine));
        SoftwareSchedule schedule = SoftwareSchedule.builder().id(SCHEDULE_ID).tenantId(TENANT).build();
        when(scheduleRepository.findOnPrimaryByTenantIdAndIdAndStatus(TENANT, SCHEDULE_ID, ScriptStatus.ACTIVE))
                .thenReturn(Optional.of(schedule));
    }

    private static SoftwareScheduleOnlineDispatch sentinel(String machineId, Instant expiresAt) {
        return SoftwareScheduleOnlineDispatch.builder()
                .id("reconnect-" + machineId).tenantId(TENANT).machineId(machineId).scheduleId(SCHEDULE_ID)
                .firstSeenAt(Instant.now().minusSeconds(60)).expiresAt(expiresAt)
                .status(DeviceOnlineDispatchStatus.NEW).build();
    }

    private static Machine machine(String machineId, DeviceStatus status, TelemetryStatus connectivity) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setStatus(status);
        m.setTelemetryStatus(connectivity);
        return m;
    }
}
