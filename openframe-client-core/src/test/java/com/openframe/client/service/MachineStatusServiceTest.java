package com.openframe.client.service;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
    @Mock private DeviceLifecycleService deviceLifecycleService;
    @Mock private ApplicationEventPublisher eventPublisher;

    @Captor private ArgumentCaptor<DeviceCameOnlineEvent> cameOnlineCaptor;

    @InjectMocks private MachineStatusService service;

    private Machine machine;

    @Test
    void updateToOnline_offlineDevice_connectivityAndLastSeenSavedStatusUntouched() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).save(machine);
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        assertThat(machine.getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
        assertThat(machine.getLastSeen()).isEqualTo(LATER);
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.MANAGED);
    }

    @Test
    void updateToOnline_offlineDevice_cameOnlinePublished() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        verify(eventPublisher).publishEvent(any(DeviceCameOnlineEvent.class));
    }

    @Test
    void updateToOffline_onlineDevice_savedWithoutEvents() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.ONLINE);

        // execution
        service.updateToOffline(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).save(machine);
        assertThat(machine.getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.MANAGED);
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
        verify(machineRepository, never()).save(any(Machine.class));
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void updateToOffline_offlineDevice_lastSeenRefreshedOnly() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);

        // execution
        service.updateToOffline(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).updateLastSeen(MACHINE_ID, LATER);
        verify(machineRepository, never()).save(any(Machine.class));
    }

    @Test
    void processHeartbeat_connectivityUnknown_savedWithoutCameOnline() {
        // setup
        stubMachine(DeviceStatus.MANAGED, null);

        // execution
        service.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).save(machine);
        assertThat(machine.getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void processHeartbeat_firstFlip_firstConnectedAtStamped() {
        // setup
        stubMachine(DeviceStatus.PENDING, null);

        // execution
        service.processHeartbeat(MACHINE_ID, LATER);

        // verifications
        assertThat(machine.getFirstConnectedAt()).isEqualTo(LATER);
    }

    @Test
    void updateToOnline_firstConnectedAtAlreadySet_keptOnFlip() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);
        machine.setFirstConnectedAt(EARLIER);

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        assertThat(machine.getFirstConnectedAt()).isEqualTo(EARLIER);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void updateToOnline_frozenDevice_connectivityMovesStatusStays(DeviceStatus frozen) {
        // setup
        stubMachine(frozen, TelemetryStatus.OFFLINE);

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).save(machine);
        assertThat(machine.getStatus()).isEqualTo(frozen);
        assertThat(machine.getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
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
        assertThat(machine.getStatus()).isEqualTo(frozen);
        verifyNoInteractions(deviceLifecycleService);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING", "MANAGED"})
    void updateToOffline_liveDevice_statusNeverWritten(DeviceStatus status) {
        // setup
        stubMachine(status, TelemetryStatus.ONLINE);

        // execution
        service.updateToOffline(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).save(machine);
        assertThat(machine.getStatus()).isEqualTo(status);
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

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        verify(machineRepository).save(machine);
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
        verify(machineRepository, never()).save(any(Machine.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verifyNoInteractions(deviceLifecycleService, eventPublisher);
    }

    @Test
    void processHeartbeat_eventAtLastSeen_treatedAsStale() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.ONLINE);

        // execution
        service.processHeartbeat(MACHINE_ID, SEEN);

        // verifications
        verify(machineRepository, never()).save(any(Machine.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
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
        verify(machineRepository, never()).save(any(Machine.class));
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
        verify(machineRepository, never()).save(any(Machine.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verifyNoInteractions(deviceLifecycleService, eventPublisher);
    }

    @Test
    void updateToOnline_offlineDevice_cameOnlineCarriesTheSavedMachine() {
        // setup
        stubMachine(DeviceStatus.MANAGED, TelemetryStatus.OFFLINE);

        // execution
        service.updateToOnline(MACHINE_ID, LATER);

        // verifications
        verify(eventPublisher).publishEvent(cameOnlineCaptor.capture());
        assertThat(cameOnlineCaptor.getValue().getMachine()).isSameAs(machine);
    }

    private void stubMachine(DeviceStatus status, TelemetryStatus telemetry) {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(status);
        machine.setTelemetryStatus(telemetry);
        machine.setLastSeen(SEEN);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }
}
