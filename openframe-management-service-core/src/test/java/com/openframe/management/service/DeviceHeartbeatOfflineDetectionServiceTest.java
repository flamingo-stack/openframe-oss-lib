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

    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;

    @Captor private ArgumentCaptor<Criteria> guardCaptor;

    @InjectMocks private DeviceHeartbeatOfflineDetectionService service;

    @Test
    void markStaleDevicesOffline_silentOnlineMachine_statusAndTelemetryOffline() {
        // setup
        Machine machine = machine("m-1", DeviceStatus.ONLINE, TelemetryStatus.ONLINE);
        when(machineRepository.findByStatusAndLastSeenBefore(eq(DeviceStatus.ONLINE), any(Instant.class))).thenReturn(List.of(machine));
        when(machineRepository.findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class))).thenReturn(List.of(machine));
        writerMatches();

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineWriter).update(eq("m-1"), guardCaptor.capture(), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactlyInAnyOrder("telemetryStatus", "status");
        Machine written = applied(machine);
        assertThat(written.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
        Document lastSeenGuard = (Document) guardCaptor.getValue().getCriteriaObject().get("lastSeen");
        assertThat(lastSeenGuard.get("$lt")).isInstanceOf(Instant.class);
        assertThat(guardCaptor.getValue().getCriteriaObject().get("status")).isEqualTo(DeviceStatus.ONLINE);
        verify(machineRepository, never()).saveAll(any());
    }

    @Test
    void markStaleDevicesOffline_silentMachineBeingDeleted_onlyTelemetryOffline() {
        // setup
        Machine machine = machine("m-1", DeviceStatus.PENDING_DELETION, TelemetryStatus.ONLINE);
        when(machineRepository.findByStatusAndLastSeenBefore(eq(DeviceStatus.ONLINE), any(Instant.class))).thenReturn(List.of());
        when(machineRepository.findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class))).thenReturn(List.of(machine));
        writerMatches();

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineWriter).update(eq("m-1"), guardCaptor.capture(), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly("telemetryStatus");
        assertThat(guardCaptor.getValue().getCriteriaObject().containsKey("status")).isFalse();
        Machine written = applied(machine);
        assertThat(written.getStatus()).isEqualTo(DeviceStatus.PENDING_DELETION);
        assertThat(written.getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
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
        verify(machineRepository, never()).saveAll(any());
    }

    private void writerMatches() {
        when(machineWriter.update(anyString(), any(Criteria.class), any(MachineUpdate.class)))
                .thenAnswer(invocation -> Optional.of(new MachineWriteResult(new Machine(), new Machine())));
    }

    private Machine applied(Machine machine) {
        Machine copy = machine("copy", machine.getStatus(), machine.getTelemetryStatus());
        updateCaptor.getValue().applyTo(copy);
        return copy;
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
