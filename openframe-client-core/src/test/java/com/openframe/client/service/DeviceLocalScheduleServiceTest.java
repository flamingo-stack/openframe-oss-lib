package com.openframe.client.service;

import com.openframe.client.service.rmm.DeviceLocalScheduleService;
import com.openframe.client.service.rmm.ScheduleFireDispatcher;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceLocalTimeDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleLocalMachineTimeDispatch;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.nats.publisher.MachineTimezoneRequestNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScheduleDeviceLocalDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceLocalScheduleServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String SCHEDULE_ID = "sched-local-1";
    // Wall-clock the user picked: 09:00, encoded as a UTC instant (offset deliberately not applied).
    private static final Instant LOCAL_RUN_AT = Instant.parse("2026-09-15T09:00:00Z");

    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private ScheduleDeviceTargetResolver targetResolver;
    @Mock private MachineRepository machineRepository;
    @Mock private ScheduleDeviceLocalDispatchRepository dispatchRepository;
    @Mock private ScheduleFireDispatcher fireDispatcher;
    @Mock private MachineTimezoneRequestNatsPublisher timezoneRequestPublisher;

    private DeviceLocalScheduleService service;

    @BeforeEach
    void setUp() {
        service = new DeviceLocalScheduleService(scheduleRepository, targetResolver, machineRepository,
                dispatchRepository, fireDispatcher, timezoneRequestPublisher);
        ReflectionTestUtils.setField(service, "catchupSeconds", 86400L);
    }

    @Test
    @DisplayName("online device due by its stored zone: timezone re-requested, fired once, recorded FIRED")
    void onlineDue_requestsRefreshFiresOnce() {
        // Kyiv is UTC+3 in September → local 09:00 == 06:00Z. now is just after that.
        Instant now = Instant.parse("2026-09-15T06:30:00Z");
        stubSchedule(List.of("m-kyiv"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-kyiv", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verify(timezoneRequestPublisher).request("m-kyiv", SCHEDULE_ID);   // refresh for future sweeps
        verify(fireDispatcher).dispatch(any(ScheduleScript.class), eq(List.of("m-kyiv")), eq(now));
        ArgumentCaptor<ScheduleLocalMachineTimeDispatch> saved = ArgumentCaptor.forClass(ScheduleLocalMachineTimeDispatch.class);
        verify(dispatchRepository).insert((ScheduleLocalMachineTimeDispatch) saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ScheduleDeviceLocalTimeDispatchStatus.FIRED);
    }

    @Test
    @DisplayName("online device whose stored-zone local time has not arrived: re-requested, not fired")
    void onlineNotYet_requestedNotFired() {
        // New York is UTC-4 in September → local 09:00 == 13:00Z; 06:30Z is well before.
        Instant now = Instant.parse("2026-09-15T06:30:00Z");
        stubSchedule(List.of("m-ny"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-ny", "America/New_York")));

        service.runDueDeviceLocalSchedules(now);

        verify(timezoneRequestPublisher).request("m-ny", SCHEDULE_ID);
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).insert(any(ScheduleLocalMachineTimeDispatch.class));
    }

    @Test
    @DisplayName("online device with no known timezone yet: requested and deferred — not fired, not recorded")
    void onlineNoStoredTimezone_deferred() {
        Instant now = Instant.parse("2026-09-15T06:30:00Z");
        stubSchedule(List.of("m-new"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-new", null)));

        service.runDueDeviceLocalSchedules(now);

        verify(timezoneRequestPublisher).request("m-new", SCHEDULE_ID);
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).insert(any(ScheduleLocalMachineTimeDispatch.class));
    }

    @Test
    @DisplayName("two online zones, one wall-clock: each fires at its OWN local time — different absolute instants")
    void differentZones_fireAtTheirOwnLocalTime() {
        Instant now = Instant.parse("2026-09-15T06:30:00Z");
        stubSchedule(List.of("m-kyiv", "m-ny"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-kyiv", "Europe/Kyiv"), online("m-ny", "America/New_York")));

        service.runDueDeviceLocalSchedules(now);

        verify(fireDispatcher).dispatch(any(ScheduleScript.class), eq(List.of("m-kyiv")), eq(now));
        verify(fireDispatcher, never()).dispatch(any(ScheduleScript.class), eq(List.of("m-ny")), any());
    }

    @Test
    @DisplayName("non-online device: never run and never requested; left for a later sweep while in window")
    void notOnline_neitherRunNorRequested() {
        Instant now = Instant.parse("2026-09-15T06:30:00Z");
        stubSchedule(List.of("m-off"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(offline("m-off", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verifyNoInteractions(timezoneRequestPublisher);
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).insert(any(ScheduleLocalMachineTimeDispatch.class));
    }

    @Test
    @DisplayName("non-online device past its run window: marked MISSED so it stops being scanned")
    void notOnlineBeyondWindow_markedMissed() {
        Instant now = Instant.parse("2026-09-17T06:30:00Z");   // two days after the Kyiv run
        stubSchedule(List.of("m-off"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(offline("m-off", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verifyNoInteractions(fireDispatcher);
        ArgumentCaptor<ScheduleLocalMachineTimeDispatch> saved = ArgumentCaptor.forClass(ScheduleLocalMachineTimeDispatch.class);
        verify(dispatchRepository).insert((ScheduleLocalMachineTimeDispatch) saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ScheduleDeviceLocalTimeDispatchStatus.MISSED);
    }

    @Test
    @DisplayName("already fired (sentinel present): the machine is skipped, never loaded, never requested")
    void alreadyFired_skipped() {
        Instant now = Instant.parse("2026-09-15T06:30:00Z");
        when(scheduleRepository.findByStatusAndTriggerAndTimeReference(
                ScriptStatus.ACTIVE, ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL))
                .thenReturn(List.of(deviceLocalSchedule()));
        when(targetResolver.resolveTargetMachineIds(any(ScheduleScript.class))).thenReturn(List.of("m-kyiv"));
        when(dispatchRepository.findByScheduleIdAndMachineIdIn(eq(SCHEDULE_ID), any()))
                .thenReturn(List.of(ScheduleLocalMachineTimeDispatch.builder()
                        .tenantId(TENANT).scheduleId(SCHEDULE_ID)
                        .machineId("m-kyiv").firedAt(now).status(ScheduleDeviceLocalTimeDispatchStatus.FIRED).build()));

        service.runDueDeviceLocalSchedules(now);

        verifyNoInteractions(timezoneRequestPublisher);
        verifyNoInteractions(fireDispatcher);
        verify(machineRepository, never()).findByTenantIdAndMachineIdIn(any(), any());
    }

    private void stubSchedule(List<String> targets) {
        when(scheduleRepository.findByStatusAndTriggerAndTimeReference(
                ScriptStatus.ACTIVE, ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL))
                .thenReturn(List.of(deviceLocalSchedule()));
        when(targetResolver.resolveTargetMachineIds(any(ScheduleScript.class))).thenReturn(targets);
        when(dispatchRepository.findByScheduleIdAndMachineIdIn(eq(SCHEDULE_ID), any())).thenReturn(List.of());
    }

    private static ScheduleScript deviceLocalSchedule() {
        return ScheduleScript.builder()
                .id(SCHEDULE_ID)
                .tenantId(TENANT)
                .name("nightly-local")
                .status(ScriptStatus.ACTIVE)
                .trigger(ScheduleScriptTrigger.DATE_TIME)
                .timeReference(ScheduleTimeReference.DEVICE_LOCAL)
                .startAt(LOCAL_RUN_AT)
                .build();
    }

    private static Machine online(String machineId, String timezone) {
        return machine(machineId, timezone, DeviceStatus.ONLINE);
    }

    private static Machine offline(String machineId, String timezone) {
        return machine(machineId, timezone, DeviceStatus.OFFLINE);
    }

    private static Machine machine(String machineId, String timezone, DeviceStatus status) {
        Machine m = new Machine();
        m.setTenantId(TENANT);
        m.setMachineId(machineId);
        m.setTimezone(timezone);
        m.setStatus(status);
        return m;
    }
}
