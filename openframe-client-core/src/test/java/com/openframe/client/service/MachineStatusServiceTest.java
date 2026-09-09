package com.openframe.client.service;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineStatusServiceTest {

    private static final String MACHINE = "m-1";
    private static final Instant SEEN = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant LATER = Instant.parse("2026-01-01T00:05:00Z");
    private static final Instant EARLIER = Instant.parse("2025-12-31T23:55:00Z");

    @Mock private MachineRepository machineRepository;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private MachineStatusService service;

    private Machine machine(DeviceStatus status) {
        return machine(status, SEEN);
    }

    private Machine machine(DeviceStatus status, Instant lastSeen) {
        Machine m = new Machine();
        m.setMachineId(MACHINE);
        m.setStatus(status);
        m.setLastSeen(lastSeen);
        return m;
    }

    private void machineIs(DeviceStatus status) {
        when(machineRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(machine(status)));
    }

    @Test
    @DisplayName("OFFLINE→ONLINE publishes DeviceCameOnlineEvent (the DEVICE_ONLINE trigger source)")
    void offlineToOnline_publishesCameOnline() {
        machineIs(DeviceStatus.OFFLINE);

        service.updateToOnline(MACHINE, LATER);

        verify(eventPublisher).publishEvent(any(DeviceCameOnlineEvent.class));
    }

    @Test
    @DisplayName("ONLINE→ONLINE (heartbeat) does NOT publish DeviceCameOnlineEvent")
    void onlineToOnline_noCameOnline() {
        machineIs(DeviceStatus.ONLINE);

        service.updateToOnline(MACHINE, LATER);

        verify(eventPublisher, never()).publishEvent(any(DeviceCameOnlineEvent.class));
    }

    @Test
    @DisplayName("PENDING→ONLINE is a first-connect, not a came-online: DeviceFirstConnectedEvent only")
    void pendingToOnline_firstConnectOnly() {
        machineIs(DeviceStatus.PENDING);

        service.updateToOnline(MACHINE, LATER);

        verify(eventPublisher).publishEvent(any(DeviceFirstConnectedEvent.class));
        verify(eventPublisher, never()).publishEvent(any(DeviceCameOnlineEvent.class));
    }

    @Test
    @DisplayName("T1: heartbeat of an already ONLINE device updates lastSeen only, never save() (no Pinot message)")
    void onlineHeartbeat_updatesLastSeenOnly() {
        machineIs(DeviceStatus.ONLINE);

        service.processHeartbeat(MACHINE, LATER);

        verify(machineRepository).updateLastSeen(MACHINE, LATER);
        verify(machineRepository, never()).save(any(Machine.class));
    }

    @Test
    @DisplayName("T2: heartbeat of an already ONLINE device publishes no application events at all")
    void onlineHeartbeat_publishesNoEvents() {
        machineIs(DeviceStatus.ONLINE);

        service.processHeartbeat(MACHINE, LATER);

        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    @DisplayName("T3: OFFLINE→ONLINE saves the machine with the new status and timestamp, never updateLastSeen")
    void offlineToOnline_savesAndPublishes() {
        machineIs(DeviceStatus.OFFLINE);

        service.updateToOnline(MACHINE, LATER);

        ArgumentCaptor<Machine> saved = ArgumentCaptor.forClass(Machine.class);
        verify(machineRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(DeviceStatus.ONLINE);
        assertThat(saved.getValue().getLastSeen()).isEqualTo(LATER);
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verify(eventPublisher).publishEvent(any(DeviceCameOnlineEvent.class));
    }

    @Test
    @DisplayName("T4: PENDING→ONLINE goes through save(), not updateLastSeen")
    void pendingToOnline_saves() {
        machineIs(DeviceStatus.PENDING);

        service.updateToOnline(MACHINE, LATER);

        verify(machineRepository).save(any(Machine.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verify(eventPublisher).publishEvent(any(DeviceFirstConnectedEvent.class));
    }

    @Test
    @DisplayName("T5: PENDING→OFFLINE goes through save(), not updateLastSeen")
    void pendingToOffline_saves() {
        machineIs(DeviceStatus.PENDING);

        service.updateToOffline(MACHINE, LATER);

        verify(machineRepository).save(any(Machine.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verify(eventPublisher).publishEvent(any(DeviceFirstConnectedEvent.class));
    }

    @Test
    @DisplayName("T6: a machine with no status yet counts as a status change and goes through save()")
    void nullStatus_saves() {
        machineIs(null);

        service.processHeartbeat(MACHINE, LATER);

        verify(machineRepository).save(any(Machine.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
    }

    @Test
    @DisplayName("T7: a stale event touches neither save() nor updateLastSeen")
    void staleEvent_touchesNothing() {
        machineIs(DeviceStatus.ONLINE);

        service.processHeartbeat(MACHINE, EARLIER);

        verify(machineRepository, never()).save(any(Machine.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
    }

    @Test
    @DisplayName("T8: an event exactly at lastSeen is stale — nothing is written")
    void eventEqualToLastSeen_touchesNothing() {
        machineIs(DeviceStatus.ONLINE);

        service.processHeartbeat(MACHINE, SEEN);

        verify(machineRepository, never()).save(any(Machine.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
    }

    @Test
    @DisplayName("T9: updateToOffline on an already OFFLINE device updates lastSeen only")
    void offlineToOffline_updatesLastSeenOnly() {
        machineIs(DeviceStatus.OFFLINE);

        service.updateToOffline(MACHINE, LATER);

        verify(machineRepository).updateLastSeen(MACHINE, LATER);
        verify(machineRepository, never()).save(any(Machine.class));
    }

    @Test
    @DisplayName("T10: an ONLINE device that has never been seen still takes the lastSeen-only path")
    void nullLastSeen_onlineDevice_updatesLastSeenOnly() {
        when(machineRepository.findByMachineId(MACHINE))
                .thenReturn(Optional.of(machine(DeviceStatus.ONLINE, null)));

        service.processHeartbeat(MACHINE, LATER);

        verify(machineRepository).updateLastSeen(MACHINE, LATER);
        verify(machineRepository, never()).save(any(Machine.class));
    }

    @Test
    @DisplayName("M2: an event for an unknown machine fails loudly and writes nothing")
    void unknownMachine_throwsAndWritesNothing() {
        when(machineRepository.findByMachineId(MACHINE)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.processHeartbeat(MACHINE, LATER))
                .isInstanceOf(MachineNotFoundException.class);

        verify(machineRepository, never()).save(any(Machine.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
    }

    @Test
    @DisplayName("T11: a device being deleted is left alone — neither save() nor updateLastSeen")
    void pendingDeletion_touchesNothing() {
        machineIs(DeviceStatus.PENDING_DELETION);

        service.processHeartbeat(MACHINE, LATER);

        verify(machineRepository, never()).save(any(Machine.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
    }
}
