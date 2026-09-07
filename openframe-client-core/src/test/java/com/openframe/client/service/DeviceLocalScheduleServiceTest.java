package com.openframe.client.service;

import com.openframe.client.service.rmm.DeviceLocalScheduleService;
import com.openframe.client.service.rmm.ScheduleFireDispatcher;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceLocalTimeDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleLocalMachineTimeDispatch;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
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
    private static final Instant START_AT = Instant.parse("2026-09-15T09:00:00Z");
    private static final long RECONNECT_WINDOW = 1800L;

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
        ReflectionTestUtils.setField(service, "catchupSeconds", RECONNECT_WINDOW);
    }

    @Test
    @DisplayName("one-shot online device due: fired once, pointer recorded FIRED at the occurrence's wall-clock")
    void oneShotDue_firesOnceRecordsPointer() {
        Instant now = Instant.parse("2026-09-15T06:05:00Z");
        stubSchedule(skip(null), List.of("m-kyiv"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-kyiv", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verify(timezoneRequestPublisher).request("m-kyiv", SCHEDULE_ID);
        verify(fireDispatcher).dispatch(any(ScheduleScript.class), eq(List.of("m-kyiv")), eq(now));
        ScheduleLocalMachineTimeDispatch saved = capturedSave();
        assertThat(saved.getStatus()).isEqualTo(ScheduleDeviceLocalTimeDispatchStatus.FIRED);
        assertThat(saved.getLastOccurrenceAt()).isEqualTo(START_AT);
    }

    @Test
    @DisplayName("recurring hourly online device: fires the CURRENT occurrence, pointer at that occurrence's wall-clock")
    void recurringDue_firesCurrentOccurrence() {
        Instant now = Instant.parse("2026-09-15T09:05:00Z");
        stubSchedule(skip(3600L), List.of("m-kyiv"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-kyiv", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verify(fireDispatcher).dispatch(any(ScheduleScript.class), eq(List.of("m-kyiv")), eq(now));
        assertThat(capturedSave().getLastOccurrenceAt()).isEqualTo(Instant.parse("2026-09-15T12:00:00Z"));
    }

    @Test
    @DisplayName("recurring current occurrence already recorded: not re-fired (but timezone kept refreshed)")
    void recurringCurrentAlreadyHandled_notReFired() {
        Instant now = Instant.parse("2026-09-15T09:05:00Z");
        stubScheduleNoDispatchStub(skip(3600L), List.of("m-kyiv"));
        when(dispatchRepository.findByScheduleIdAndMachineIdIn(eq(SCHEDULE_ID), any()))
                .thenReturn(List.of(pointer("m-kyiv", Instant.parse("2026-09-15T12:00:00Z"))));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-kyiv", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verify(timezoneRequestPublisher).request("m-kyiv", SCHEDULE_ID);
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).save(any());
    }

    @Test
    @DisplayName("online device whose occurrence has not arrived yet: re-requested, not fired")
    void notYet_requestedNotFired() {
        Instant now = Instant.parse("2026-09-15T06:05:00Z");
        stubSchedule(skip(null), List.of("m-ny"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-ny", "America/New_York")));

        service.runDueDeviceLocalSchedules(now);

        verify(timezoneRequestPublisher).request("m-ny", SCHEDULE_ID);
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).save(any());
    }

    @Test
    @DisplayName("online device with no known timezone yet: requested and deferred — not fired, not recorded")
    void noStoredTimezone_deferred() {
        Instant now = Instant.parse("2026-09-15T06:05:00Z");
        stubSchedule(skip(null), List.of("m-new"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-new", null)));

        service.runDueDeviceLocalSchedules(now);

        verify(timezoneRequestPublisher).request("m-new", SCHEDULE_ID);
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).save(any());
    }

    @Test
    @DisplayName("one-shot already handled: skipped entirely — no refresh, no fire")
    void oneShotAlreadyHandled_skipped() {
        Instant now = Instant.parse("2026-09-15T06:05:00Z");
        stubScheduleNoDispatchStub(skip(null), List.of("m-kyiv"));
        when(dispatchRepository.findByScheduleIdAndMachineIdIn(eq(SCHEDULE_ID), any()))
                .thenReturn(List.of(pointer("m-kyiv", START_AT)));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-kyiv", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verifyNoInteractions(timezoneRequestPublisher);
        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).save(any());
    }

    @Test
    @DisplayName("SKIP + offline at the occurrence: MISSED immediately, no retry, no dispatch")
    void skipOffline_missedImmediately() {
        Instant now = Instant.parse("2026-09-15T06:05:00Z");   // Kyiv occurrence 06:00Z is due
        stubSchedule(skip(null), List.of("m-off"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(offline("m-off", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verifyNoInteractions(fireDispatcher);
        assertThat(capturedSave().getStatus()).isEqualTo(ScheduleDeviceLocalTimeDispatchStatus.MISSED);
    }

    @Test
    @DisplayName("RETRY + offline still inside the reconnect window: wait — not missed, not fired")
    void retryOffline_withinWindow_waits() {
        Instant now = Instant.parse("2026-09-15T06:05:00Z");   // 5 min past the 06:00Z occurrence, window 30 min
        stubSchedule(retry(null, RECONNECT_WINDOW), List.of("m-off"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(offline("m-off", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verifyNoInteractions(fireDispatcher);
        verify(dispatchRepository, never()).save(any());
    }

    @Test
    @DisplayName("RETRY + offline past the reconnect window: MISSED")
    void retryOffline_pastWindow_missed() {
        Instant now = Instant.parse("2026-09-15T06:40:00Z");   // 40 min past the 06:00Z occurrence, window 30 min
        stubSchedule(retry(null, RECONNECT_WINDOW), List.of("m-off"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(offline("m-off", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verifyNoInteractions(fireDispatcher);
        assertThat(capturedSave().getStatus()).isEqualTo(ScheduleDeviceLocalTimeDispatchStatus.MISSED);
    }

    @Test
    @DisplayName("RETRY + online inside the window: fired normally")
    void retryOnline_withinWindow_fires() {
        Instant now = Instant.parse("2026-09-15T06:05:00Z");
        stubSchedule(retry(null, RECONNECT_WINDOW), List.of("m-kyiv"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online("m-kyiv", "Europe/Kyiv")));

        service.runDueDeviceLocalSchedules(now);

        verify(fireDispatcher).dispatch(any(ScheduleScript.class), eq(List.of("m-kyiv")), eq(now));
        assertThat(capturedSave().getStatus()).isEqualTo(ScheduleDeviceLocalTimeDispatchStatus.FIRED);
    }

    private ScheduleLocalMachineTimeDispatch capturedSave() {
        ArgumentCaptor<ScheduleLocalMachineTimeDispatch> captor =
                ArgumentCaptor.forClass(ScheduleLocalMachineTimeDispatch.class);
        verify(dispatchRepository).save(captor.capture());
        return captor.getValue();
    }

    private void stubSchedule(ScheduleScript schedule, List<String> targets) {
        stubScheduleNoDispatchStub(schedule, targets);
        when(dispatchRepository.findByScheduleIdAndMachineIdIn(eq(SCHEDULE_ID), any())).thenReturn(List.of());
    }

    private void stubScheduleNoDispatchStub(ScheduleScript schedule, List<String> targets) {
        when(scheduleRepository.findByStatusAndTriggerAndTimeReference(
                ScriptStatus.ACTIVE, ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL))
                .thenReturn(List.of(schedule));
        when(targetResolver.resolveTargetMachineIds(any(ScheduleScript.class))).thenReturn(targets);
    }

    private static ScheduleScript skip(Long repeat) {
        return schedule(repeat, ScheduleOfflineBehavior.SKIP, null);
    }

    private static ScheduleScript retry(Long repeat, Long reconnectWindowSeconds) {
        return schedule(repeat, ScheduleOfflineBehavior.RETRY_ON_RECONNECT, reconnectWindowSeconds);
    }

    private static ScheduleScript schedule(Long repeat, ScheduleOfflineBehavior offlineBehavior,
                                           Long reconnectWindowSeconds) {
        return ScheduleScript.builder()
                .id(SCHEDULE_ID)
                .tenantId(TENANT)
                .name("nightly-local")
                .status(ScriptStatus.ACTIVE)
                .trigger(ScheduleScriptTrigger.DATE_TIME)
                .timeReference(ScheduleTimeReference.DEVICE_LOCAL)
                .offlineBehavior(offlineBehavior)
                .reconnectWindowSeconds(reconnectWindowSeconds)
                .startAt(START_AT)
                .repeat(repeat)
                .build();
    }

    private static ScheduleLocalMachineTimeDispatch pointer(String machineId, Instant lastOccurrenceAt) {
        return ScheduleLocalMachineTimeDispatch.builder()
                .tenantId(TENANT).scheduleId(SCHEDULE_ID).machineId(machineId)
                .lastOccurrenceAt(lastOccurrenceAt).firedAt(lastOccurrenceAt)
                .status(ScheduleDeviceLocalTimeDispatchStatus.FIRED).build();
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
