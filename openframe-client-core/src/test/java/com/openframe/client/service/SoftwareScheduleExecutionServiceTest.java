package com.openframe.client.service;

import com.openframe.client.service.rmm.SoftwareDeviceLocalScheduleService;
import com.openframe.client.service.rmm.SoftwareScheduleExecutionService;
import com.openframe.client.service.rmm.SoftwareScheduleFireDispatcher;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import com.openframe.data.service.rmm.ScheduleMutationTransaction;
import com.openframe.publishing.transaction.MongoTransactionRunner;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SoftwareScheduleExecutionServiceTest {

    private static final String TENANT = "t-1";

    private final SoftwareScheduleRepository scheduleRepository = mock(SoftwareScheduleRepository.class);
    private final SoftwareScheduleTargetResolver targetResolver = mock(SoftwareScheduleTargetResolver.class);
    private final SoftwareScheduleFireDispatcher fireDispatcher = mock(SoftwareScheduleFireDispatcher.class);
    private final SoftwareDeviceLocalScheduleService deviceLocalScheduleService = mock(SoftwareDeviceLocalScheduleService.class);
    private final MachineRepository machineRepository = mock(MachineRepository.class);
    private final SoftwareScheduleOnlineDispatchRepository onlineDispatchRepository = mock(SoftwareScheduleOnlineDispatchRepository.class);
    private final ScheduleMutationTransaction scheduleTransaction = mock(ScheduleMutationTransaction.class);

    private final SoftwareScheduleExecutionService service = new SoftwareScheduleExecutionService(
            scheduleRepository, targetResolver, fireDispatcher, deviceLocalScheduleService,
            machineRepository, onlineDispatchRepository, scheduleTransaction);

    @Test
    @DisplayName("a due repeating schedule fires to its ONLINE targets and advances nextRunAt into the future")
    void runDue_firesOnlineAndAdvancesRepeat() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(3600L).nextRunAt(Instant.now().minusSeconds(30))
                .build();
        due(schedule);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of("m-1", "m-2"));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-1", DeviceStatus.MANAGED, TelemetryStatus.ONLINE), machine("m-2", DeviceStatus.MANAGED, TelemetryStatus.ONLINE)));

        service.runDueSchedules();

        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-1", "m-2")), any());
        ArgumentCaptor<SoftwareSchedule> saved = ArgumentCaptor.forClass(SoftwareSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getNextRunAt()).isAfter(Instant.now());
        assertThat(saved.getValue().getLastRunAt()).isNotNull();
    }

    @Test
    @DisplayName("a one-shot schedule fires its ONLINE device once and clears nextRunAt")
    void runDue_oneShotClearsNextRunAt() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(null).nextRunAt(Instant.now().minusSeconds(30))
                .build();
        due(schedule);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of("m-1"));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-1", DeviceStatus.MANAGED, TelemetryStatus.ONLINE)));

        service.runDueSchedules();

        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-1")), any());
        ArgumentCaptor<SoftwareSchedule> saved = ArgumentCaptor.forClass(SoftwareSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getNextRunAt()).isNull();
    }

    @Test
    void runDue_deletedTargetsNeitherDispatchNorArmReconnect() {
        // setup
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).nextRunAt(Instant.now().minusSeconds(30))
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT).reconnectWindowSeconds(3600L)
                .build();
        due(schedule);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of("m-online", "m-offline"));
        Machine online = machine("m-online", DeviceStatus.DELETED, TelemetryStatus.OFFLINE);
        online.setTelemetryStatus(TelemetryStatus.ONLINE);
        Machine offline = machine("m-offline", DeviceStatus.DELETED, TelemetryStatus.OFFLINE);
        offline.setTelemetryStatus(TelemetryStatus.OFFLINE);
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online, offline));

        // execution
        service.runDueSchedules();

        // verifications
        verify(fireDispatcher, never()).dispatch(any(), any(), any());
        verify(onlineDispatchRepository, never()).insert(any(SoftwareScheduleOnlineDispatch.class));
    }

    @Test
    void runDue_refreshesAssignmentsAfterReadingManagedDevices() {
        // setup
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).nextRunAt(Instant.now().minusSeconds(30)).build();
        due(schedule);
        when(targetResolver.resolveMachineIds(schedule))
                .thenReturn(List.of("retained-first", "reenrolled", "retained-last"),
                        List.of("retained-last", "retained-first", "new-assignment"));
        Machine reenrolled = machine("reenrolled", DeviceStatus.MANAGED, TelemetryStatus.ONLINE);
        reenrolled.setStatus(DeviceStatus.MANAGED);
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any())).thenReturn(List.of(
                machine("retained-first", DeviceStatus.MANAGED, TelemetryStatus.ONLINE), reenrolled,
                machine("retained-last", DeviceStatus.MANAGED, TelemetryStatus.ONLINE)));

        // execution
        service.runDueSchedules();

        // verifications
        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("retained-first", "retained-last")), any());
        InOrder readsAndDispatch = inOrder(targetResolver, machineRepository, fireDispatcher);
        readsAndDispatch.verify(targetResolver).resolveMachineIds(schedule);
        readsAndDispatch.verify(machineRepository).findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any());
        readsAndDispatch.verify(targetResolver).resolveMachineIds(schedule);
        readsAndDispatch.verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("retained-first", "retained-last")), any());
    }

    @Test
    @DisplayName("RETRY_ON_RECONNECT: an offline target is not dispatched but armed for reconnect with an expiry")
    void runDue_offlineRetry_armsSentinel() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(null).nextRunAt(Instant.now().minusSeconds(30))
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT).reconnectWindowSeconds(3600L)
                .build();
        dueOfflineTarget(schedule);
        when(machineRepository.reserveForSoftwareReconnect(TENANT, "m-off", null, DeviceStatus.CONNECTED))
                .thenReturn(1L);

        service.runDueSchedules();

        verify(fireDispatcher, never()).dispatch(any(), any(), any());
        ArgumentCaptor<SoftwareScheduleOnlineDispatch> sentinel = ArgumentCaptor.forClass(SoftwareScheduleOnlineDispatch.class);
        verify(onlineDispatchRepository).insert(sentinel.capture());
        assertThat(sentinel.getValue().getMachineId()).isEqualTo("m-off");
        assertThat(sentinel.getValue().getScheduleId()).isEqualTo("ss-1");
        assertThat(sentinel.getValue().getStatus()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
        assertThat(sentinel.getValue().getExpiresAt()).isNotNull();
    }

    @Test
    void runDue_armsReconnectAfterAnOfflineTargetIsRenamed() {
        // setup
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .nextRunAt(Instant.now().minusSeconds(30))
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT).reconnectWindowSeconds(3600L)
                .build();
        dueOfflineTarget(schedule);
        Machine renamed = machine("m-off", DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);
        renamed.setVersion(2L);
        Machine changedAgain = machine("m-off", DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);
        changedAgain.setVersion(3L);
        when(machineRepository.findOnPrimaryByTenantIdAndMachineId(TENANT, "m-off"))
                .thenReturn(Optional.of(renamed), Optional.of(changedAgain));
        when(targetResolver.isCurrentTarget(schedule, renamed)).thenReturn(true);
        when(targetResolver.isCurrentTarget(schedule, changedAgain)).thenReturn(true);
        when(machineRepository.reserveForSoftwareReconnect(TENANT, "m-off", 2L, DeviceStatus.CONNECTED))
                .thenThrow(new OptimisticLockingFailureException("device changed while arming reconnect"));
        when(machineRepository.reserveForSoftwareReconnect(TENANT, "m-off", 3L, DeviceStatus.CONNECTED)).thenReturn(1L);

        // execution
        service.runDueSchedules();

        // verifications
        ArgumentCaptor<SoftwareScheduleOnlineDispatch> pending = ArgumentCaptor.forClass(SoftwareScheduleOnlineDispatch.class);
        verify(onlineDispatchRepository).insert(pending.capture());
        assertThat(pending.getValue().getMachineId()).isEqualTo("m-off");
        assertThat(pending.getValue().getStatus()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
    }

    @Test
    void runDue_retriesOneShotAfterRepeatedReconnectWriteConflicts() {
        // setup
        Instant scheduledFor = Instant.now().minusSeconds(7200);
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE).nextRunAt(scheduledFor)
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT).reconnectWindowSeconds(3600L)
                .build();
        dueOfflineTarget(schedule);
        Machine offline = machine("m-off", DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);
        Machine online = machine("m-on", DeviceStatus.MANAGED, TelemetryStatus.ONLINE);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of("m-on", "m-off"));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(online, offline));
        when(machineRepository.reserveForSoftwareReconnect(TENANT, "m-off", null, DeviceStatus.CONNECTED))
                .thenThrow(new OptimisticLockingFailureException("first write conflict"))
                .thenThrow(new OptimisticLockingFailureException("second write conflict"))
                .thenReturn(1L);

        // execution
        service.runDueSchedules();

        // verifications
        assertThat(schedule.getNextRunAt()).isEqualTo(scheduledFor);
        assertThat(schedule.getLastRunAt()).isNull();
        verify(scheduleRepository, never()).save(any());
        verify(fireDispatcher, never()).dispatch(any(), any(), any());
        verify(onlineDispatchRepository, never()).insert(any(SoftwareScheduleOnlineDispatch.class));

        service.runDueSchedules();

        ArgumentCaptor<SoftwareScheduleOnlineDispatch> pending = ArgumentCaptor.forClass(SoftwareScheduleOnlineDispatch.class);
        verify(onlineDispatchRepository).insert(pending.capture());
        assertThat(pending.getValue().getScheduledFor()).isEqualTo(scheduledFor);
        assertThat(pending.getValue().getExpiresAt()).isEqualTo(pending.getValue().getFirstSeenAt().plusSeconds(3600L));
        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-on")), any());
        verify(scheduleRepository).save(schedule);
        assertThat(schedule.getNextRunAt()).isNull();
    }

    @Test
    void runDue_skipsDirectDispatchForDevicesAlreadyHandledByReconnect() {
        // setup
        Instant scheduledFor = Instant.now().minusSeconds(30);
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE).nextRunAt(scheduledFor)
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT).reconnectWindowSeconds(3600L)
                .build();
        due(schedule);
        List<String> candidates = List.of("m-on", "m-reconnected");
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(candidates);
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-on", DeviceStatus.MANAGED, TelemetryStatus.ONLINE), machine("m-reconnected", DeviceStatus.MANAGED, TelemetryStatus.ONLINE)));
        SoftwareScheduleOnlineDispatch dispatchedOnReconnect = SoftwareScheduleOnlineDispatch.builder()
                .tenantId(TENANT).scheduleId(schedule.getId()).machineId("m-reconnected")
                .scheduledFor(scheduledFor).status(DeviceOnlineDispatchStatus.DISPATCHED).build();
        when(onlineDispatchRepository.findByTenantIdAndMachineIdInAndScheduleIdAndScheduledFor(
                TENANT, candidates, schedule.getId(), scheduledFor)).thenReturn(List.of(dispatchedOnReconnect));

        // execution
        service.runDueSchedules();

        // verifications
        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-on")), any());
        assertThat(schedule.getNextRunAt()).isNull();
    }

    @Test
    void runDue_doesNotArmFromStaleMachineSnapshot() {
        // setup
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .nextRunAt(Instant.now().minusSeconds(30))
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT).reconnectWindowSeconds(3600L)
                .build();
        dueOfflineTarget(schedule);

        // execution
        service.runDueSchedules();

        // verifications
        verify(machineRepository).reserveForSoftwareReconnect(TENANT, "m-off", null, DeviceStatus.CONNECTED);
        verify(onlineDispatchRepository, never()).insert(any(SoftwareScheduleOnlineDispatch.class));
    }

    @Test
    @DisplayName("SKIP (default): an offline target is neither dispatched nor armed")
    void runDue_offlineSkip_noArm() {
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(null).nextRunAt(Instant.now().minusSeconds(30))
                .offlineBehavior(ScheduleOfflineBehavior.SKIP)
                .build();
        due(schedule);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of("m-off"));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-off", DeviceStatus.MANAGED, TelemetryStatus.OFFLINE)));

        service.runDueSchedules();

        verify(fireDispatcher, never()).dispatch(any(), any(), any());
        verify(onlineDispatchRepository, never()).insert(any(SoftwareScheduleOnlineDispatch.class));
    }

    @Test
    @DisplayName("online is decided by telemetryStatus: status MANAGED with telemetry OFFLINE goes to the offline branch")
    void runDue_statusOnlineTelemetryOffline_treatedAsOffline() {
        // setup
        SoftwareSchedule schedule = SoftwareSchedule.builder()
                .id("ss-1").tenantId(TENANT).status(ScriptStatus.ACTIVE)
                .repeat(null).nextRunAt(Instant.now().minusSeconds(30))
                .offlineBehavior(ScheduleOfflineBehavior.SKIP)
                .build();
        due(schedule);
        Machine staleStatus = machine("m-stale", DeviceStatus.MANAGED, TelemetryStatus.ONLINE);
        staleStatus.setTelemetryStatus(TelemetryStatus.OFFLINE);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of("m-stale"));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any())).thenReturn(List.of(staleStatus));

        // execution
        service.runDueSchedules();

        // verifications
        verify(fireDispatcher, never()).dispatch(any(), any(), any());
        verify(onlineDispatchRepository, never()).insert(any(SoftwareScheduleOnlineDispatch.class));
    }

    @Test
    @DisplayName("no due schedules → nothing fired or saved")
    void runDue_noneDue_noop() {
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of());

        service.runDueSchedules();

        verify(fireDispatcher, never()).dispatch(any(), any(), any());
        verify(scheduleRepository, never()).save(any());
    }

    private void due(SoftwareSchedule schedule) {
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));
    }

    private void dueOfflineTarget(SoftwareSchedule schedule) {
        due(schedule);
        Machine machine = machine("m-off", DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);
        when(targetResolver.resolveMachineIds(schedule)).thenReturn(List.of(machine.getMachineId()));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(eq(TENANT), any())).thenReturn(List.of(machine));
        when(scheduleRepository.findOnPrimaryByTenantIdAndIdAndStatus(TENANT, schedule.getId(), ScriptStatus.ACTIVE))
                .thenReturn(Optional.of(schedule));
        when(machineRepository.findOnPrimaryByTenantIdAndMachineId(TENANT, machine.getMachineId()))
                .thenReturn(Optional.of(machine));
        when(targetResolver.isCurrentTarget(schedule, machine)).thenReturn(true);
        when(scheduleTransaction.run(any())).thenAnswer(invocation -> {
            MongoTransactionRunner.Transaction<Boolean> mutation = invocation.getArgument(0);
            return mutation.execute();
        });
    }

    private static Machine machine(String machineId, DeviceStatus status, TelemetryStatus connectivity) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setStatus(status);
        m.setTelemetryStatus(connectivity);
        return m;
    }
}
