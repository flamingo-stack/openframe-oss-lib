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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
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

    private static final String MACHINE_ID = "m-1";

    @Mock private MachineRepository machineRepository;
    @Mock private MachineWriter machineWriter;

    @Captor private ArgumentCaptor<Criteria> guardCaptor;
    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;

    @InjectMocks private DeviceHeartbeatOfflineDetectionService service;

    @Test
    void markStaleDevicesOffline_silentOnlineMachine_connectivityOfflineGuardedOnStillOnline() {
        // setup
        Machine machine = machine(MACHINE_ID, DeviceStatus.MANAGED);
        stubStale(machine);
        stubWritten(MACHINE_ID, machine);

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), guardCaptor.capture(), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly("telemetryStatus");
        assertThat(applied(updateCaptor.getValue()).getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
        Document guard = guardCaptor.getValue().getCriteriaObject();
        assertThat(guard.get("lastSeen", Document.class)).containsKey("$lt");
        assertThat(guard)
                .containsEntry("telemetryStatus", TelemetryStatus.ONLINE)
                .doesNotContainKey("status");
        verify(machineRepository, never()).saveAll(any());
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING", "MANAGED", "ONLINE", "PENDING_DELETION", "ARCHIVED"})
    void markStaleDevicesOffline_anyLifecycleStatus_statusNeverWritten(DeviceStatus status) {
        // setup
        Machine machine = machine(MACHINE_ID, status);
        stubStale(machine);
        stubWritten(MACHINE_ID, machine);

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), guardCaptor.capture(), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).doesNotContain("status");
        assertThat(guardCaptor.getValue().getCriteriaObject()).doesNotContainKey("status");
    }

    @Test
    void markStaleDevicesOffline_heartbeatLandedMeanwhile_otherMachinesStillMarked() {
        // setup
        Machine fresh = machine("m-1", DeviceStatus.MANAGED);
        Machine silent = machine("m-2", DeviceStatus.MANAGED);
        stubStale(fresh, silent);
        when(machineWriter.update(eq("m-1"), any(Criteria.class), any(MachineUpdate.class))).thenReturn(Optional.empty());
        stubWritten("m-2", silent);

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineWriter).update(eq("m-2"), any(Criteria.class), any(MachineUpdate.class));
    }

    @Test
    void markStaleDevicesOffline_nothingStale_nothingWritten() {
        // setup
        stubStale();

        // execution
        service.markStaleDevicesOffline();

        // verifications
        verify(machineWriter, never()).update(anyString(), any(Criteria.class), any(MachineUpdate.class));
        verify(machineRepository, never()).saveAll(any());
    }

    private void stubStale(Machine... machines) {
        when(machineRepository.findByTelemetryStatusAndLastSeenBefore(eq(TelemetryStatus.ONLINE), any(Instant.class)))
                .thenReturn(List.of(machines));
    }

    private void stubWritten(String machineId, Machine machine) {
        when(machineWriter.update(eq(machineId), any(Criteria.class), any(MachineUpdate.class)))
                .thenReturn(Optional.of(new MachineWriteResult(machine, machine)));
    }

    private static Machine applied(MachineUpdate update) {
        Machine machine = new Machine();
        update.applyTo(machine);
        return machine;
    }

    private static Machine machine(String machineId, DeviceStatus status) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setStatus(status);
        machine.setTelemetryStatus(TelemetryStatus.ONLINE);
        machine.setLastSeen(Instant.parse("2026-01-01T00:00:00Z"));
        return machine;
    }
}
