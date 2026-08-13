package com.openframe.client.service;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineStatusServiceTest {

    private static final String MACHINE = "m-1";
    private static final Instant SEEN = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant LATER = Instant.parse("2026-01-01T00:05:00Z");

    @Mock private MachineRepository machineRepository;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private MachineStatusService service;

    private Machine machine(DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(MACHINE);
        m.setStatus(status);
        m.setLastSeen(SEEN);
        return m;
    }

    @Test
    @DisplayName("OFFLINE→ONLINE publishes DeviceCameOnlineEvent (the DEVICE_ONLINE trigger source)")
    void offlineToOnline_publishesCameOnline() {
        when(machineRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(machine(DeviceStatus.OFFLINE)));

        service.updateToOnline(MACHINE, LATER);

        verify(eventPublisher).publishEvent(any(DeviceCameOnlineEvent.class));
    }

    @Test
    @DisplayName("ONLINE→ONLINE (heartbeat) does NOT publish DeviceCameOnlineEvent")
    void onlineToOnline_noCameOnline() {
        when(machineRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(machine(DeviceStatus.ONLINE)));

        service.updateToOnline(MACHINE, LATER);

        verify(eventPublisher, never()).publishEvent(any(DeviceCameOnlineEvent.class));
    }

    @Test
    @DisplayName("PENDING→ONLINE is a first-connect, not a came-online: DeviceFirstConnectedEvent only")
    void pendingToOnline_firstConnectOnly() {
        when(machineRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(machine(DeviceStatus.PENDING)));

        service.updateToOnline(MACHINE, LATER);

        verify(eventPublisher).publishEvent(any(DeviceFirstConnectedEvent.class));
        verify(eventPublisher, never()).publishEvent(any(DeviceCameOnlineEvent.class));
    }
}
