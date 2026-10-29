package com.openframe.management.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Criteria;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceHeartbeatOfflineDetectionServiceTest {

    @Mock private MachineRepository machineRepository;
    @Mock private MachineWriter machineWriter;

    @Captor private ArgumentCaptor<Criteria> guardCaptor;
    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;

    @InjectMocks private DeviceHeartbeatOfflineDetectionService service;

    @Test
    void markStaleDevicesOffline_silentOnlineMachine_statusAndTelemetryOfflineWhileStillOnline() {
        // setup
        Machine machine = machine("m-1", DeviceStatus.ONLINE, TelemetryStatus.ONLINE);
        when(machineRepository.findByStatusAndLastSeenBefore(eq(DeviceStatus.ONLINE), any(Instant.class))).thenReturn(List.of(machine));
        when(machineRepository.findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class))).thenReturn(List.of(machine));
        when(machineWriter.update(eq("m-1"), any(Criteria.class), any(MachineUpdate.class))).thenReturn(written(machine));

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineWriter).update(eq("m-1"), guardCaptor.capture(), updateCaptor.capture());
        Machine updated = applied(updateCaptor.getValue());
        assertThat(updated.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        assertThat(updated.getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
        Document guard = guardCaptor.getValue().getCriteriaObject();
        assertThat(guard.get("lastSeen", Document.class)).containsKey("$lt");
        assertThat(guard.get("status")).isEqualTo(DeviceStatus.ONLINE);
        verify(machineRepository, never()).saveAll(any());
    }

    @Test
    void markStaleDevicesOffline_silentMachineBeingDeleted_onlyTelemetryOfflineWhileTelemetryStillOnline() {
        // setup
        Machine machine = machine("m-1", DeviceStatus.PENDING_DELETION, TelemetryStatus.ONLINE);
        when(machineRepository.findByStatusAndLastSeenBefore(eq(DeviceStatus.ONLINE), any(Instant.class))).thenReturn(List.of());
        when(machineRepository.findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class))).thenReturn(List.of(machine));
        when(machineWriter.update(eq("m-1"), any(Criteria.class), any(MachineUpdate.class))).thenReturn(written(machine));

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineWriter).update(eq("m-1"), guardCaptor.capture(), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly("telemetryStatus");
        Document guard = guardCaptor.getValue().getCriteriaObject();
        assertThat(guard.get("telemetryStatus")).isEqualTo(TelemetryStatus.ONLINE);
        assertThat(guard).doesNotContainKey("status");
    }

    @Test
    void markStaleDevicesOffline_heartbeatLandedMeanwhile_otherMachinesStillMarked() {
        // setup
        Machine fresh = machine("m-1", DeviceStatus.ONLINE, TelemetryStatus.ONLINE);
        Machine silent = machine("m-2", DeviceStatus.ONLINE, TelemetryStatus.ONLINE);
        when(machineRepository.findByStatusAndLastSeenBefore(eq(DeviceStatus.ONLINE), any(Instant.class))).thenReturn(List.of(fresh, silent));
        when(machineRepository.findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class))).thenReturn(List.of());
        when(machineWriter.update(eq("m-1"), any(Criteria.class), any(MachineUpdate.class))).thenReturn(Optional.empty());
        when(machineWriter.update(eq("m-2"), any(Criteria.class), any(MachineUpdate.class))).thenReturn(written(silent));

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineWriter).update(eq("m-2"), any(Criteria.class), any(MachineUpdate.class));
    }

    @Test
    void markStaleDevicesOffline_nothingStale_nothingWritten() {
        // setup
        when(machineRepository.findByStatusAndLastSeenBefore(eq(DeviceStatus.ONLINE), any(Instant.class))).thenReturn(List.of());
        when(machineRepository.findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class))).thenReturn(List.of());

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineWriter, never()).update(anyString(), any(Criteria.class), any(MachineUpdate.class));
    }

    private static Optional<MachineWriteResult> written(Machine machine) {
        return Optional.of(new MachineWriteResult(machine, machine));
    }

    private static Machine applied(MachineUpdate update) {
        Machine machine = new Machine();
        update.applyTo(machine);
        return machine;
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
