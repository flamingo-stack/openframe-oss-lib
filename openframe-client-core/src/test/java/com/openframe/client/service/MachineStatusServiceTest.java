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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.BeanUtils;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.mongodb.core.query.Criteria;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.verifyNoInteractions;
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
    @Mock private MachineWriter machineWriter;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private MachineStatusService service;

    private Machine stored;

    @BeforeEach
    void writerAppliesTheUpdateToTheStoredMachine() {
        lenient().when(machineWriter.update(eq(MACHINE), any(MachineUpdate.class))).thenAnswer(invocation -> {
            Machine after = copyOf(stored);
            invocation.getArgument(1, MachineUpdate.class).applyTo(after);
            return Optional.of(new MachineWriteResult(stored, after));
        });
        lenient().when(machineWriter.update(eq(MACHINE), any(Criteria.class), any(MachineUpdate.class))).thenAnswer(invocation -> {
            Machine after = copyOf(stored);
            invocation.getArgument(2, MachineUpdate.class).applyTo(after);
            return Optional.of(new MachineWriteResult(stored, after));
        });
    }

    private Machine machine(DeviceStatus status) {
        return machine(status, SEEN);
    }

    private Machine machine(DeviceStatus status, Instant lastSeen) {
        Machine m = new Machine();
        m.setMachineId(MACHINE);
        m.setStatus(status);
        m.setTelemetryStatus(status == DeviceStatus.OFFLINE ? TelemetryStatus.OFFLINE : TelemetryStatus.ONLINE);
        m.setLastSeen(lastSeen);
        return m;
    }

    private void machineIs(DeviceStatus status) {
        storedMachineIs(machine(status));
    }

    private void storedMachineIs(Machine machine) {
        stored = machine;
        when(machineRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(machine));
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
        verifyNoInteractions(machineWriter);
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

        Machine written = written();
        assertThat(written.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        assertThat(written.getLastSeen()).isEqualTo(LATER);
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verify(eventPublisher).publishEvent(any(DeviceCameOnlineEvent.class));
    }

    @Test
    @DisplayName("T4: PENDING→ONLINE goes through save(), not updateLastSeen")
    void pendingToOnline_saves() {
        machineIs(DeviceStatus.PENDING);

        service.updateToOnline(MACHINE, LATER);

        verify(machineWriter).update(eq(MACHINE), any(Criteria.class), any(MachineUpdate.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verify(eventPublisher).publishEvent(any(DeviceFirstConnectedEvent.class));
    }

    @Test
    @DisplayName("T5: PENDING→OFFLINE goes through save(), not updateLastSeen")
    void pendingToOffline_saves() {
        machineIs(DeviceStatus.PENDING);

        service.updateToOffline(MACHINE, LATER);

        verify(machineWriter).update(eq(MACHINE), any(Criteria.class), any(MachineUpdate.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        verify(eventPublisher).publishEvent(any(DeviceFirstConnectedEvent.class));
    }

    @Test
    @DisplayName("T6: a machine with no status yet counts as a status change and goes through save()")
    void nullStatus_saves() {
        machineIs(null);

        service.processHeartbeat(MACHINE, LATER);

        verify(machineWriter).update(eq(MACHINE), any(Criteria.class), any(MachineUpdate.class));
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
    }

    @Test
    @DisplayName("T7: a stale event touches neither save() nor updateLastSeen")
    void staleEvent_touchesNothing() {
        machineIs(DeviceStatus.ONLINE);

        service.processHeartbeat(MACHINE, EARLIER);

        verifyNoInteractions(machineWriter);
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
    }

    @Test
    @DisplayName("T8: an event exactly at lastSeen is stale — nothing is written")
    void eventEqualToLastSeen_touchesNothing() {
        machineIs(DeviceStatus.ONLINE);

        service.processHeartbeat(MACHINE, SEEN);

        verifyNoInteractions(machineWriter);
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
    }

    @Test
    @DisplayName("T9: updateToOffline on an already OFFLINE device updates lastSeen only")
    void offlineToOffline_updatesLastSeenOnly() {
        machineIs(DeviceStatus.OFFLINE);

        service.updateToOffline(MACHINE, LATER);

        verify(machineRepository).updateLastSeen(MACHINE, LATER);
        verifyNoInteractions(machineWriter);
    }

    @Test
    @DisplayName("T10: an ONLINE device that has never been seen still takes the lastSeen-only path")
    void nullLastSeen_onlineDevice_updatesLastSeenOnly() {
        storedMachineIs(machine(DeviceStatus.ONLINE, null));

        service.processHeartbeat(MACHINE, LATER);

        verify(machineRepository).updateLastSeen(MACHINE, LATER);
        verifyNoInteractions(machineWriter);
    }

    @Test
    @DisplayName("M2: an event for an unknown machine fails loudly and writes nothing")
    void unknownMachine_throwsAndWritesNothing() {
        when(machineRepository.findByMachineId(MACHINE)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.processHeartbeat(MACHINE, LATER))
                .isInstanceOf(MachineNotFoundException.class);

        verifyNoInteractions(machineWriter);
        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
    }

    @Test
    @DisplayName("T11: a device being deleted keeps its status, only its connectivity moves")
    void pendingDeletion_presenceOnly() {
        machineIs(DeviceStatus.PENDING_DELETION);

        service.processHeartbeat(MACHINE, LATER);

        verify(machineRepository).updateLastSeen(MACHINE, LATER);
        verifyNoInteractions(machineWriter);
    }

    @Test
    @DisplayName("T11b: a deleted device that disconnects records the connectivity flip, status untouched")
    void deleted_connectivityFlipSaved() {
        machineIs(DeviceStatus.DELETED);

        service.updateToOffline(MACHINE, LATER);

        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        assertThat(writtenPaths()).containsExactlyInAnyOrder("telemetryStatus", "lastSeen");
        assertThat(written().getStatus()).isEqualTo(DeviceStatus.DELETED);
        assertThat(written().getTelemetryStatus()).isEqualTo(TelemetryStatus.OFFLINE);
    }

    @Test
    @DisplayName("T12: the first heartbeat after the field appeared fills telemetryStatus through save()")
    void firstHeartbeat_telemetryStillEmpty_saved() {
        Machine machine = machine(DeviceStatus.ONLINE);
        machine.setTelemetryStatus(null);
        storedMachineIs(machine);

        service.processHeartbeat(MACHINE, LATER);

        verify(machineRepository, never()).updateLastSeen(anyString(), any(Instant.class));
        assertThat(written().getTelemetryStatus()).isEqualTo(TelemetryStatus.ONLINE);
        assertThat(written().getStatus()).isEqualTo(DeviceStatus.ONLINE);
    }

    @Test
    @DisplayName("E1: PENDING→ONLINE stamps firstConnectedAt with the event timestamp (enrollment milestone)")
    void pendingToOnline_stampsFirstConnectedAtWithEventTimestamp() {
        machineIs(DeviceStatus.PENDING);
        service.updateToOnline(MACHINE, LATER);
        assertThat(written().getFirstConnectedAt()).isEqualTo(LATER);
    }

    @Test
    @DisplayName("E2: PENDING→OFFLINE is also a first connect and stamps firstConnectedAt")
    void pendingToOffline_stampsFirstConnectedAt() {
        machineIs(DeviceStatus.PENDING);
        service.updateToOffline(MACHINE, LATER);
        assertThat(written().getFirstConnectedAt()).isEqualTo(LATER);
    }

    @Test
    @DisplayName("E3: OFFLINE→ONLINE leaves an existing firstConnectedAt untouched")
    void offlineToOnline_leavesFirstConnectedAtUntouched() {
        Machine m = machine(DeviceStatus.OFFLINE);
        m.setFirstConnectedAt(EARLIER);
        storedMachineIs(m);
        service.updateToOnline(MACHINE, LATER);
        assertThat(written().getFirstConnectedAt()).isEqualTo(EARLIER);
    }

    @Test
    @DisplayName("E4: a PENDING machine that already carries firstConnectedAt keeps the original stamp on reconnect")
    void pendingToOnline_neverOverwritesAnExistingFirstConnectedAt() {
        Machine m = machine(DeviceStatus.PENDING);
        m.setFirstConnectedAt(EARLIER);
        storedMachineIs(m);
        service.updateToOnline(MACHINE, LATER);
        assertThat(written().getFirstConnectedAt()).isEqualTo(EARLIER);
    }

    @Test
    @DisplayName("L1: a status change writes only the fields it owns, so concurrent directory and Fleet writes survive")
    void statusChange_writesOnlyStatusFields() {
        machineIs(DeviceStatus.PENDING);

        service.updateToOnline(MACHINE, LATER);

        assertThat(writtenPaths())
                .containsExactlyInAnyOrder("status", "telemetryStatus", "lastSeen", "firstConnectedAt");
    }

    @Test
    @DisplayName("L2: a machine deleted between the read and the write publishes no application event")
    void machineGoneBeforeTheWrite_noEvents() {
        machineIs(DeviceStatus.PENDING);
        when(machineWriter.update(eq(MACHINE), any(Criteria.class), any(MachineUpdate.class))).thenReturn(Optional.empty());

        service.updateToOnline(MACHINE, LATER);

        verify(eventPublisher, never()).publishEvent(any());
    }

    // The one MachineWriter.update call, guarded or not
    private MachineUpdate writtenUpdate() {
        List<Object[]> writes = mockingDetails(machineWriter).getInvocations().stream()
                .filter(invocation -> invocation.getMethod().getName().equals("update"))
                .map(invocation -> invocation.getArguments())
                .toList();
        assertThat(writes).hasSize(1);
        Object[] arguments = writes.getFirst();
        return (MachineUpdate) arguments[arguments.length - 1];
    }

    @Test
    @DisplayName("L3: a status transition only lands while the status is still the one it was decided from")
    void statusChange_guardedOnThePreviousStatus() {
        machineIs(DeviceStatus.OFFLINE);

        service.updateToOnline(MACHINE, LATER);

        ArgumentCaptor<Criteria> guard = ArgumentCaptor.forClass(Criteria.class);
        verify(machineWriter).update(eq(MACHINE), guard.capture(), any(MachineUpdate.class));
        assertThat(guard.getValue().getCriteriaObject().get("status")).isEqualTo(DeviceStatus.OFFLINE);
    }

    private Set<String> writtenPaths() {
        return writtenUpdate().paths();
    }

    private Machine written() {
        Machine after = copyOf(stored);
        writtenUpdate().applyTo(after);
        return after;
    }

    private static Machine copyOf(Machine source) {
        Machine copy = new Machine();
        BeanUtils.copyProperties(source, copy);
        return copy;
    }
}
