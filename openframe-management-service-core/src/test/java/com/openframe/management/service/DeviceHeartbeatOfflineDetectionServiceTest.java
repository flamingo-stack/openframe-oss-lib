package com.openframe.management.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceHeartbeatOfflineDetectionServiceTest {

    @Mock private MachineRepository machineRepository;

    @Captor private ArgumentCaptor<List<Machine>> savedCaptor;

    @InjectMocks private DeviceHeartbeatOfflineDetectionService service;

    @Test
    void markStaleDevicesOffline_silentOnlineMachine_statusAndTelemetryOffline() {
        // setup
        Machine machine = machine("m-1", DeviceStatus.ONLINE, TelemetryStatus.ONLINE);
        when(machineRepository.findByStatusAndLastSeenBefore(eq(DeviceStatus.ONLINE), any(Instant.class))).thenReturn(List.of(machine));
        when(machineRepository.findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class))).thenReturn(List.of(machine));

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineRepository).saveAll(savedCaptor.capture());
        assertThat(savedCaptor.getValue()).containsExactly(machine);
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        assertThat(machine.getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
    }

    @Test
    void markStaleDevicesOffline_silentMachineBeingDeleted_onlyTelemetryOffline() {
        // setup
        Machine machine = machine("m-1", DeviceStatus.PENDING_DELETION, TelemetryStatus.ONLINE);
        when(machineRepository.findByStatusAndLastSeenBefore(eq(DeviceStatus.ONLINE), any(Instant.class))).thenReturn(List.of());
        when(machineRepository.findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class))).thenReturn(List.of(machine));

        // execution
        service.markStaleDevicesOffline();

        // verifications
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.PENDING_DELETION);
        assertThat(machine.getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
        verify(machineRepository).saveAll(List.of(machine));
    }

    @Test
    void markStaleDevicesOffline_nothingStale_nothingSaved() {
        // setup
        when(machineRepository.findByStatusAndLastSeenBefore(eq(DeviceStatus.ONLINE), any(Instant.class))).thenReturn(List.of());
        when(machineRepository.findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class))).thenReturn(List.of());

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineRepository, never()).saveAll(any());
    }

    private static Machine machine(String machineId, DeviceStatus status, TelemetryStatus telemetryStatus) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setStatus(status);
        machine.setTelemetryStatus(telemetryStatus);
        machine.setLastSeen(Instant.parse("2026-01-01T00:00:00Z"));
        return machine;
    }
}
