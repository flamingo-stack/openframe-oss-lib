package com.openframe.client.service;

import com.openframe.client.exception.InvalidAgentIdException;
import com.openframe.client.exception.InvalidToolTypeException;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.client.service.agentregistration.transformer.ToolAgentIdTransformerService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolConnectionServiceTest {

    private static final String MACHINE_ID = "m-1";
    private static final String RAW_AGENT_TOOL_ID = "raw-42";
    private static final String AGENT_TOOL_ID = "42";

    @Mock private ToolConnectionRepository toolConnectionRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private ToolAgentIdTransformerService toolAgentIdTransformerService;
    @Mock private DeviceLifecycleService deviceLifecycleService;

    @Captor private ArgumentCaptor<ToolConnection> connectionCaptor;

    @InjectMocks private ToolConnectionService service;

    private Machine machine;
    private ToolConnection existing;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        existing = new ToolConnection();
        existing.setMachineId(MACHINE_ID);
        existing.setToolType(ToolType.FLEET_MDM);
        existing.setAgentToolId(AGENT_TOOL_ID);
        existing.setStatus(ConnectionStatus.CONNECTED);
    }

    @Test
    void addToolConnection_newTool_savedConnectedAndPromotionChecked() {
        // setup
        stubMachineExists();
        stubTransform();
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM)).thenReturn(Optional.empty());

        // execution
        service.addToolConnection(MACHINE_ID, "fleet_mdm", RAW_AGENT_TOOL_ID, false);

        // verifications
        verify(toolConnectionRepository).save(connectionCaptor.capture());
        ToolConnection saved = connectionCaptor.getValue();
        assertThat(saved.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(saved.getToolType()).isEqualTo(ToolType.FLEET_MDM);
        assertThat(saved.getAgentToolId()).isEqualTo(AGENT_TOOL_ID);
        assertThat(saved.getStatus()).isEqualTo(ConnectionStatus.CONNECTED);
        assertThat(saved.getConnectedAt()).isNotNull();
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
    }

    @Test
    void addToolConnection_disconnectedTool_reconnectedAndPromotionChecked() {
        // setup
        stubMachineExists();
        stubTransform();
        existing.setStatus(ConnectionStatus.DISCONNECTED);
        existing.setDisconnectedAt(Instant.now());
        stubExisting();

        // execution
        service.addToolConnection(MACHINE_ID, "FLEET_MDM", RAW_AGENT_TOOL_ID, false);

        // verifications
        verify(toolConnectionRepository).save(existing);
        assertThat(existing.getStatus()).isEqualTo(ConnectionStatus.CONNECTED);
        assertThat(existing.getDisconnectedAt()).isNull();
        assertThat(existing.getConnectedAt()).isNotNull();
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
    }

    @Test
    void addToolConnection_connectedWithSameId_nothingSavedButPromotionChecked() {
        // setup
        stubMachineExists();
        stubTransform();
        stubExisting();

        // execution
        service.addToolConnection(MACHINE_ID, "FLEET_MDM", RAW_AGENT_TOOL_ID, false);

        // verifications
        verify(toolConnectionRepository, never()).save(any(ToolConnection.class));
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
    }

    @Test
    void addToolConnection_connectedWithNewId_agentToolIdReplaced() {
        // setup
        stubMachineExists();
        stubTransform();
        existing.setAgentToolId("old-id");
        stubExisting();

        // execution
        service.addToolConnection(MACHINE_ID, "FLEET_MDM", RAW_AGENT_TOOL_ID, false);

        // verifications
        verify(toolConnectionRepository).save(existing);
        assertThat(existing.getAgentToolId()).isEqualTo(AGENT_TOOL_ID);
        assertThat(existing.getLastSyncAt()).isNotNull();
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void addToolConnection_blankAgentId_throwsInvalidAgentId(String agentId) {
        // execution
        InvalidAgentIdException ex = assertThrows(InvalidAgentIdException.class,
                () -> service.addToolConnection(agentId, "FLEET_MDM", RAW_AGENT_TOOL_ID, false));

        // verifications
        assertThat(ex.getMessage()).contains("Agent ID cannot be empty");
        verifyNoInteractions(toolConnectionRepository, deviceLifecycleService);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void addToolConnection_blankToolType_throwsInvalidToolType(String toolType) {
        // execution
        InvalidToolTypeException ex = assertThrows(InvalidToolTypeException.class,
                () -> service.addToolConnection(MACHINE_ID, toolType, RAW_AGENT_TOOL_ID, false));

        // verifications
        assertThat(ex.getMessage()).contains("Tool type cannot be empty");
        verifyNoInteractions(toolConnectionRepository, deviceLifecycleService);
    }

    @Test
    void addToolConnection_unknownToolType_throwsInvalidToolType() {
        // setup
        stubMachineExists();

        // execution
        InvalidToolTypeException ex = assertThrows(InvalidToolTypeException.class,
                () -> service.addToolConnection(MACHINE_ID, "BOGUS", RAW_AGENT_TOOL_ID, false));

        // verifications
        assertThat(ex.getMessage()).contains("Invalid tool type: BOGUS");
        verifyNoInteractions(toolConnectionRepository, deviceLifecycleService);
    }

    @Test
    void addToolConnection_unknownMachine_throwsMachineNotFound() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        MachineNotFoundException ex = assertThrows(MachineNotFoundException.class,
                () -> service.addToolConnection(MACHINE_ID, "FLEET_MDM", RAW_AGENT_TOOL_ID, false));

        // verifications
        assertThat(ex.getMessage()).contains(MACHINE_ID);
        verifyNoInteractions(toolConnectionRepository, deviceLifecycleService);
    }

    @Test
    void disconnectAll_connectedAndAlreadyDisconnected_onlyConnectedSavedNoLifecycleChange() {
        // setup
        ToolConnection alreadyGone = new ToolConnection();
        alreadyGone.setMachineId(MACHINE_ID);
        alreadyGone.setToolType(ToolType.MESHCENTRAL);
        alreadyGone.setStatus(ConnectionStatus.DISCONNECTED);
        when(toolConnectionRepository.findByMachineId(MACHINE_ID)).thenReturn(List.of(existing, alreadyGone));

        // execution
        service.disconnectAll(MACHINE_ID);

        // verifications
        verify(toolConnectionRepository).save(existing);
        verify(toolConnectionRepository, never()).save(alreadyGone);
        assertThat(existing.getStatus()).isEqualTo(ConnectionStatus.DISCONNECTED);
        assertThat(existing.getDisconnectedAt()).isNotNull();
        verifyNoInteractions(deviceLifecycleService, machineRepository);
    }

    private void stubMachineExists() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }

    private void stubTransform() {
        when(toolAgentIdTransformerService.transform(ToolType.FLEET_MDM, MACHINE_ID, RAW_AGENT_TOOL_ID, false))
                .thenReturn(AGENT_TOOL_ID);
    }

    private void stubExisting() {
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM)).thenReturn(Optional.of(existing));
    }
}
