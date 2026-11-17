package com.openframe.client.service;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.BeanUtils;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.mongodb.core.query.Criteria;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineStatusServiceTest {

    private static final String MACHINE_ID = "m-1";
    private static final Instant SEEN = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant LATER = Instant.parse("2026-01-01T00:05:00Z");
    private static final Instant EARLIER = Instant.parse("2025-12-31T23:55:00Z");

    @Mock private MachineRepository machineRepository;
    @Mock private MachineWriter machineWriter;
    @Mock private DeviceLifecycleService deviceLifecycleService;
    @Mock private ApplicationEventPublisher eventPublisher;

    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;
    @Captor private ArgumentCaptor<DeviceCameOnlineEvent> cameOnlineCaptor;
    @Captor private ArgumentCaptor<DeviceFirstConnectedEvent> firstConnectedCaptor;
    @Captor private ArgumentCaptor<Criteria> guardCaptor;

    private MachineStatusService service;
    private MachineStatusService managedStatusOff;

    private Machine machine;

    @BeforeEach
    void setUp() {
        service = new MachineStatusService(machineRepository, machineWriter, deviceLifecycleService, eventPublisher, true);
        managedStatusOff = new MachineStatusService(machineRepository, machineWriter, deviceLifecycleService, eventPublisher, false);
    }

    @Test
    void updateToOnline_offlineDevice_connectivityAndLastSeenWrittenStatusUntouched() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);
        stubWriter();

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        Machine written = written();
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
        assertThat(written.getLastSeen()).isEqualTo(LATER);
        assertThat(updateCaptor.getValue().paths()).doesNotContain("status");
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verify(machineRepository, never()).save(any(Machine.class));
    }

    @Test
    void updateToOnline_offlineDevice_cameOnlineCarriesTheWrittenMachine() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);
        stubWriter();

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        verify(eventPublisher).publishEvent(cameOnlineCaptor.capture());
        assertThat(cameOnlineCaptor.getValue().getMachine().getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
    }

    @Test
    void updateToOffline_onlineDevice_writtenWithoutEvents() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.ONLINE);
        stubWriter();

        // execution
        service.updateToOffline(MACHINE_ID, LATER);

        // verifications
        Machine written = written();
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
        assertThat(updateCaptor.getValue().paths()).doesNotContain("status");
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void processHeartbeat_onlineDevice_lastSeenRefreshedOnly() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.ONLINE);

        // execution
        service.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).updateLastSeen(MACHINE_ID, LATER);
        verifyNoInteractions(machineWriter, eventPublisher);
    }

    @Test
    void updateToOffline_offlineDevice_lastSeenRefreshedOnly() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);

        // execution
        service.updateToOffline(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).updateLastSeen(MACHINE_ID, LATER);
        verifyNoInteractions(machineWriter);
    }

    @Test
    void processHeartbeat_connectivityUnknown_writtenWithoutCameOnline() {
        // setup
        stubMachine(DeviceStatus.MANAGED, null);
        stubWriter();

        // execution
        service.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        assertThat(written().getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void processHeartbeat_firstFlip_firstConnectedAtStamped() {
        // setup
        stubMachine(DeviceStatus.PENDING, null);
        stubWriter();

        // execution
        service.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        assertThat(written().getFirstConnectedAt()).isEqualTo(LATER);
    }

    @Test
    void updateToOnline_firstConnectedAtAlreadySet_notRewritten() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);
        machine.setFirstConnectedAt(EARLIER);
        stubWriter();

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        written();
        assertThat(updateCaptor.getValue().paths()).containsExactlyInAnyOrder("telemetryStatus", "lastSeen");
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void updateToOnline_frozenDevice_connectivityMovesStatusStays(DeviceStatus frozen) {
        // setup
        stubMachine(frozen, TelemetryStatus.OFFLINE);
        stubWriter();

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        Machine written = written();
        assertThat(written.getStatus()).isEqualTo(frozen);
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
        assertThat(updateCaptor.getValue().paths()).doesNotContain("status");
        verifyNoInteractions(deviceLifecycleService);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void processHeartbeat_frozenDevice_lastSeenRefreshedStatusStays(DeviceStatus frozen) {
        // setup
        stubMachine(frozen, TelemetryStatus.ONLINE);

        // execution
        service.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).updateLastSeen(MACHINE_ID, LATER);
        verifyNoInteractions(machineWriter, deviceLifecycleService);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING", "MANAGED"})
    void updateToOffline_liveDevice_statusNeverWritten(DeviceStatus status) {
        // setup
        stubMachine(status, TelemetryStatus.ONLINE);
        stubWriter();

        // execution
        service.updateToOffline(MACHINE_ID, LATER);

        // verifications
        assertThat(written().getStatus()).isEqualTo(status);
        assertThat(updateCaptor.getValue().paths()).doesNotContain("status");
    }

    @Test
    void processHeartbeat_pendingDeviceAlreadyOnline_promotionCheckedAfterLastSeen() {
        // setup
        stubMachine(DeviceStatus.PENDING, TelemetryStatus.ONLINE);

        // execution
        service.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).updateLastSeen(MACHINE_ID, LATER);
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
    }

    @Test
    void updateToOnline_pendingDeviceFlips_promotionCheckedAndCameOnlinePublished() {
        // setup
        stubMachine(DeviceStatus.PENDING, TelemetryStatus.OFFLINE);
        stubWriter();

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), any(MachineUpdate.class));
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
        verify(eventPublisher).publishEvent(any(DeviceCameOnlineEvent.class));
    }

    @Test
    void processHeartbeat_managedDevice_promotionNotChecked() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.ONLINE);

        // execution
        service.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        verifyNoInteractions(deviceLifecycleService);
    }

    @Test
    void processHeartbeat_staleEvent_nothingWrittenNoPromotion() {
        // setup
        stubMachine(DeviceStatus.PENDING, TelemetryStatus.ONLINE);

        // execution
        service.processHeartbeat(MACHINE_ID, EARLIER);

        // verifications
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verifyNoInteractions(machineWriter, deviceLifecycleService, eventPublisher);
    }

    @Test
    void processHeartbeat_eventAtLastSeen_treatedAsStale() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.ONLINE);

        // execution
        service.processHeartbeat(MACHINE_ID, SEEN);

        // verifications
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verifyNoInteractions(machineWriter);
    }

    @Test
    void processHeartbeat_neverSeenOnlineDevice_lastSeenRefreshedOnly() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.ONLINE);
        machine.setLastSeen(null);

        // execution
        service.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).updateLastSeen(MACHINE_ID, LATER);
        verifyNoInteractions(machineWriter);
    }

    @Test
    void updateToOnline_machineGoneBeforeTheWrite_noEventNoPromotion() {
        // setup
        stubMachine(DeviceStatus.PENDING, TelemetryStatus.OFFLINE);
        when(machineWriter.update(eq(MACHINE_ID), any(MachineUpdate.class))).thenReturn(Optional.empty());

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        verifyNoInteractions(eventPublisher, deviceLifecycleService);
    }

    @Test
    void updateToOffline_firstEverFlip_firstConnectedAtStampedWithoutCameOnline() {
        // setup
        stubMachine(DeviceStatus.PENDING, null);
        stubWriter();

        // execution
        service.updateToOffline(MACHINE_ID, LATER);

        // verifications
        Machine written = written();
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
        assertThat(written.getFirstConnectedAt()).isEqualTo(LATER);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void processHeartbeat_unknownMachine_throwsAndWritesNothing() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        MachineNotFoundException ex = assertThrows(MachineNotFoundException.class,
                () -> service.processHeartbeat(MACHINE_ID, LATER));

        // verifications
        assertThat(ex.getMessage()).contains(MACHINE_ID);
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verifyNoInteractions(machineWriter, deviceLifecycleService, eventPublisher);
    }

    @Test
    void processHeartbeat_flagOffPendingDevice_statusOnlineAndFirstConnectedPublishedWithoutPromotion() {
        // setup
        stubMachine(DeviceStatus.PENDING, null);
        stubGuardedWriter();

        // execution
        managedStatusOff.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        Machine written = guardedWritten();
        assertThat(written.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
        assertThat(written.getLastSeen()).isEqualTo(LATER);
        assertThat(written.getFirstConnectedAt()).isEqualTo(LATER);
        assertThat(guardCaptor.getValue().getCriteriaObject()).containsEntry("status", DeviceStatus.PENDING);
        verify(eventPublisher).publishEvent(firstConnectedCaptor.capture());
        assertThat(firstConnectedCaptor.getValue().getMachine().getStatus()).isEqualTo(DeviceStatus.ONLINE);
        verify(eventPublisher, never()).publishEvent(any(DeviceCameOnlineEvent.class));
        verifyNoInteractions(deviceLifecycleService);
    }

    @Test
    void updateToOffline_flagOffPendingDevice_statusOfflineAndFirstConnectedPublished() {
        // setup
        stubMachine(DeviceStatus.PENDING, null);
        stubGuardedWriter();

        // execution
        managedStatusOff.updateToOffline(MACHINE_ID, LATER);

        // verifications
        Machine written = guardedWritten();
        assertThat(written.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
        verify(eventPublisher).publishEvent(any(DeviceFirstConnectedEvent.class));
        verify(eventPublisher, never()).publishEvent(any(DeviceCameOnlineEvent.class));
        verifyNoInteractions(deviceLifecycleService);
    }

    @Test
    void updateToOnline_flagOffOfflineDevice_statusOnlineAndCameOnlinePublished() {
        // setup
        stubMachine(DeviceStatus.OFFLINE, TelemetryStatus.OFFLINE);
        machine.setFirstConnectedAt(EARLIER);
        stubGuardedWriter();

        // execution
        managedStatusOff.updateToOnline(MACHINE_ID, LATER);

        // verifications
        Machine written = guardedWritten();
        assertThat(written.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
        assertThat(updateCaptor.getValue().paths()).containsExactlyInAnyOrder("status", "telemetryStatus", "lastSeen");
        assertThat(guardCaptor.getValue().getCriteriaObject()).containsEntry("status", DeviceStatus.OFFLINE);
        verify(eventPublisher).publishEvent(cameOnlineCaptor.capture());
        assertThat(cameOnlineCaptor.getValue().getMachine().getStatus()).isEqualTo(DeviceStatus.ONLINE);
        verify(eventPublisher, never()).publishEvent(any(DeviceFirstConnectedEvent.class));
    }

    @Test
    void updateToOffline_flagOffOnlineDevice_statusOfflineWithoutEvents() {
        // setup
        stubMachine(DeviceStatus.ONLINE, TelemetryStatus.ONLINE);
        stubGuardedWriter();

        // execution
        managedStatusOff.updateToOffline(MACHINE_ID, LATER);

        // verifications
        Machine written = guardedWritten();
        assertThat(written.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
        verifyNoInteractions(eventPublisher, deviceLifecycleService);
    }

    @Test
    void processHeartbeat_flagOffOnlineDevice_lastSeenRefreshedOnly() {
        // setup
        stubMachine(DeviceStatus.ONLINE, TelemetryStatus.ONLINE);

        // execution
        managedStatusOff.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).updateLastSeen(MACHINE_ID, LATER);
        verifyNoInteractions(machineWriter, eventPublisher, deviceLifecycleService);
    }

    @Test
    void updateToOnline_flagOffManagedDeviceOffline_backToOnlineAndCameOnlinePublished() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);
        stubGuardedWriter();

        // execution
        managedStatusOff.updateToOnline(MACHINE_ID, LATER);

        // verifications
        assertThat(guardedWritten().getStatus()).isEqualTo(DeviceStatus.ONLINE);
        verify(eventPublisher).publishEvent(any(DeviceCameOnlineEvent.class));
        verify(eventPublisher, never()).publishEvent(any(DeviceFirstConnectedEvent.class));
    }

    @Test
    void updateToOffline_flagOffManagedDeviceOffline_statusOfflineWithoutCameOnline() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);
        stubGuardedWriter();

        // execution
        managedStatusOff.updateToOffline(MACHINE_ID, LATER);

        // verifications
        Machine written = guardedWritten();
        assertThat(written.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        assertThat(guardCaptor.getValue().getCriteriaObject()).containsEntry("status", DeviceStatus.MANAGED);
        verifyNoInteractions(eventPublisher, deviceLifecycleService);
    }

    @Test
    void processHeartbeat_flagOffPendingDeviceWithStaleOfflineConnectivity_firstConnectedOnly() {
        // setup
        stubMachine(DeviceStatus.PENDING, TelemetryStatus.OFFLINE);
        stubGuardedWriter();

        // execution
        managedStatusOff.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        assertThat(guardedWritten().getStatus()).isEqualTo(DeviceStatus.ONLINE);
        verify(eventPublisher).publishEvent(any(DeviceFirstConnectedEvent.class));
        verify(eventPublisher, never()).publishEvent(any(DeviceCameOnlineEvent.class));
        verifyNoInteractions(deviceLifecycleService);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void updateToOnline_flagOffFrozenDevice_connectivityMovesStatusStaysNoEvents(DeviceStatus frozen) {
        // setup
        stubMachine(frozen, TelemetryStatus.OFFLINE);
        stubWriter();

        // execution
        managedStatusOff.updateToOnline(MACHINE_ID, LATER);

        // verifications
        Machine written = written();
        assertThat(written.getStatus()).isEqualTo(frozen);
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
        assertThat(updateCaptor.getValue().paths()).doesNotContain("status");
        verifyNoInteractions(eventPublisher, deviceLifecycleService);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void processHeartbeat_flagOffFrozenDevice_lastSeenRefreshedStatusStays(DeviceStatus frozen) {
        // setup
        stubMachine(frozen, TelemetryStatus.ONLINE);

        // execution
        managedStatusOff.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).updateLastSeen(MACHINE_ID, LATER);
        verifyNoInteractions(machineWriter, eventPublisher, deviceLifecycleService);
    }

    @Test
    void updateToOnline_flagOffStatusChangedSinceTheRead_presenceRecordedWithoutEvents() {
        // setup
        stubMachine(DeviceStatus.OFFLINE, TelemetryStatus.OFFLINE);
        when(machineWriter.update(eq(MACHINE_ID), any(Criteria.class), any(MachineUpdate.class))).thenReturn(Optional.empty());
        stubWriter();

        // execution
        managedStatusOff.updateToOnline(MACHINE_ID, LATER);

        // verifications
        Machine written = written();
        assertThat(written.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
        assertThat(updateCaptor.getValue().paths()).doesNotContain("status");
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void processHeartbeat_flagOffStaleEvent_nothingWritten() {
        // setup
        stubMachine(DeviceStatus.PENDING, null);

        // execution
        managedStatusOff.processHeartbeat(MACHINE_ID, EARLIER);

        // verifications
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verifyNoInteractions(machineWriter, eventPublisher, deviceLifecycleService);
    }

    private void stubMachine(DeviceStatus status, TelemetryStatus telemetry) {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(status);
        machine.setTelemetryStatus(telemetry);
        machine.setLastSeen(SEEN);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }

    private void stubWriter() {
        when(machineWriter.update(eq(MACHINE_ID), any(MachineUpdate.class))).thenAnswer(invocation -> {
            Machine after = new Machine();
            BeanUtils.copyProperties(machine, after);
            invocation.getArgument(1, MachineUpdate.class).applyTo(after);
            return Optional.of(new MachineWriteResult(machine, after));
        });
    }

    private void stubGuardedWriter() {
        when(machineWriter.update(eq(MACHINE_ID), any(Criteria.class), any(MachineUpdate.class))).thenAnswer(invocation -> {
            Machine after = new Machine();
            BeanUtils.copyProperties(machine, after);
            invocation.getArgument(2, MachineUpdate.class).applyTo(after);
            return Optional.of(new MachineWriteResult(machine, after));
        });
    }

    private Machine guardedWritten() {
        verify(machineWriter).update(eq(MACHINE_ID), guardCaptor.capture(), updateCaptor.capture());
        Machine after = new Machine();
        BeanUtils.copyProperties(machine, after);
        updateCaptor.getValue().applyTo(after);
        return after;
    }

    private Machine written() {
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine after = new Machine();
        BeanUtils.copyProperties(machine, after);
        updateCaptor.getValue().applyTo(after);
        return after;
    }
}
