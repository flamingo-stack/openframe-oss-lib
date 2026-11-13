package com.openframe.client.service;

import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.RequiredTools;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceLifecycleServiceTest {

    private static final String MACHINE_ID = "m-1";
    private static final Instant REGISTERED = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant SEEN = Instant.parse("2026-01-01T00:00:20Z");

    @Mock private MachineRepository machineRepository;
    @Mock private ToolConnectionRepository toolConnectionRepository;
    @Mock private MachineWriter machineWriter;
    @Mock private ApplicationEventPublisher eventPublisher;

    @Captor private ArgumentCaptor<Criteria> guardCaptor;
    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;
    @Captor private ArgumentCaptor<DeviceFirstConnectedEvent> eventCaptor;

    @InjectMocks private DeviceLifecycleService service;

    private Machine machine;
    private Machine promoted;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.PENDING);
        machine.setRegisteredAt(REGISTERED);
        machine.setLastSeen(SEEN);
        promoted = new Machine();
        promoted.setMachineId(MACHINE_ID);
        promoted.setStatus(DeviceStatus.MANAGED);
    }

    @Test
    void promoteIfReady_seenAndBothToolsConnected_promotedAtomicallyAndEventPublished() {
        // setup
        stubMachineFound();
        stubRequiredTools(fleet("42"), mesh("mesh-node"));
        stubWriteWins();

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), guardCaptor.capture(), updateCaptor.capture());
        Document guard = guardCaptor.getValue().getCriteriaObject();
        assertThat(guard).containsEntry("status", DeviceStatus.PENDING);
        Machine applied = applied(updateCaptor.getValue());
        assertThat(applied.getStatus()).isEqualTo(DeviceStatus.MANAGED);
        assertThat(updateCaptor.getValue().paths()).containsExactly("status");
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().getMachine()).isSameAs(promoted);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"MANAGED", "ONLINE", "OFFLINE", "PENDING_DELETION", "DELETED", "ARCHIVED"})
    void promoteIfReady_notPending_noop(DeviceStatus status) {
        // setup
        machine.setStatus(status);
        stubMachineFound();

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verifyNoInteractions(toolConnectionRepository, machineWriter, eventPublisher);
    }

    @Test
    void promoteIfReady_neverSeen_noop() {
        // setup
        machine.setLastSeen(null);
        stubMachineFound();

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verifyNoInteractions(toolConnectionRepository, machineWriter, eventPublisher);
    }

    @Test
    void promoteIfReady_lastSeenNotAfterRegistration_noop() {
        // setup
        machine.setLastSeen(REGISTERED);
        stubMachineFound();

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verifyNoInteractions(toolConnectionRepository, machineWriter, eventPublisher);
    }

    @Test
    void promoteIfReady_registeredAtMissing_anyHeartbeatCounts() {
        // setup
        machine.setRegisteredAt(null);
        stubMachineFound();
        stubRequiredTools(fleet("42"), mesh("mesh-node"));
        stubWriteWins();

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verify(eventPublisher).publishEvent(any(DeviceFirstConnectedEvent.class));
    }

    @Test
    void promoteIfReady_onlyFleetConnected_noop() {
        // setup
        stubMachineFound();
        stubRequiredTools(fleet("42"));

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verifyNoInteractions(machineWriter, eventPublisher);
    }

    @Test
    void promoteIfReady_noToolConnected_noop() {
        // setup
        stubMachineFound();
        stubRequiredTools();

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verifyNoInteractions(machineWriter, eventPublisher);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void promoteIfReady_meshConnectedWithoutAgentToolId_noop(String agentToolId) {
        // setup
        stubMachineFound();
        stubRequiredTools(fleet("42"), mesh(agentToolId));

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verifyNoInteractions(machineWriter, eventPublisher);
    }

    @Test
    void promoteIfReady_lostTheRace_nothingPublished() {
        // setup
        stubMachineFound();
        stubRequiredTools(fleet("42"), mesh("mesh-node"));
        when(machineWriter.update(eq(MACHINE_ID), any(Criteria.class), any(MachineUpdate.class)))
                .thenReturn(Optional.empty());

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void promoteIfReady_unknownMachine_noop() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verifyNoInteractions(toolConnectionRepository, machineWriter, eventPublisher);
    }

    @Test
    void promoteIfReady_toolsChecked_onlyRequiredConnectedOnesAreRead() {
        // setup
        stubMachineFound();
        stubRequiredTools();

        // execution
        service.promoteIfReady(MACHINE_ID);

        // verifications
        verify(toolConnectionRepository).findByMachineIdAndToolTypeInAndStatus(
                MACHINE_ID, RequiredTools.REQUIRED_TOOL_TYPES, ConnectionStatus.CONNECTED);
        verify(machineWriter, never()).update(anyString(), any(Criteria.class), any(MachineUpdate.class));
    }

    private void stubMachineFound() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }

    private void stubRequiredTools(ToolConnection... connections) {
        when(toolConnectionRepository.findByMachineIdAndToolTypeInAndStatus(
                MACHINE_ID, RequiredTools.REQUIRED_TOOL_TYPES, ConnectionStatus.CONNECTED))
                .thenReturn(List.of(connections));
    }

    private void stubWriteWins() {
        when(machineWriter.update(eq(MACHINE_ID), any(Criteria.class), any(MachineUpdate.class)))
                .thenReturn(Optional.of(new MachineWriteResult(machine, promoted)));
    }

    private static ToolConnection fleet(String agentToolId) {
        return connection(ToolType.FLEET_MDM, agentToolId);
    }

    private static ToolConnection mesh(String agentToolId) {
        return connection(ToolType.MESHCENTRAL, agentToolId);
    }

    private static ToolConnection connection(ToolType toolType, String agentToolId) {
        ToolConnection connection = new ToolConnection();
        connection.setMachineId(MACHINE_ID);
        connection.setToolType(toolType);
        connection.setStatus(ConnectionStatus.CONNECTED);
        connection.setAgentToolId(agentToolId);
        return connection;
    }

    private static Machine applied(MachineUpdate update) {
        Machine target = new Machine();
        update.applyTo(target);
        return target;
    }
}
