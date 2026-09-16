package com.openframe.client.service;

import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.client.service.rmm.delivery.DeliveryTracker;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InstalledAgentServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String AGENT_TYPE = "tactical-agent";
    private static final String OLD_VERSION = "1.0.0";
    private static final String VERSION = "1.2.3";

    @Mock private InstalledAgentRepository installedAgentRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private DeliveryTracker deliveryTracker;

    @Captor private ArgumentCaptor<InstalledAgent> installedAgentCaptor;

    @InjectMocks private InstalledAgentService service;

    private Machine machine;
    private InstalledAgent existing;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        existing = new InstalledAgent();
        existing.setMachineId(MACHINE_ID);
        existing.setAgentType(AGENT_TYPE);
        existing.setVersion(OLD_VERSION);
        existing.setStatus(ConnectionStatus.DISCONNECTED);
    }

    @Test
    void addInstalledAgent_newAgent_savedAndDeliveryCompleted() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(installedAgentRepository.findByMachineIdAndAgentType(MACHINE_ID, AGENT_TYPE)).thenReturn(Optional.empty());

        // execution
        service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false);

        // verifications
        verify(installedAgentRepository).save(installedAgentCaptor.capture());
        assertThat(installedAgentCaptor.getValue().getVersion()).isEqualTo(VERSION);
        assertThat(installedAgentCaptor.getValue().getStatus()).isEqualTo(ConnectionStatus.CONNECTED);
        verify(deliveryTracker).complete(DeliveryKind.TOOL_INSTALLATION, AGENT_TYPE, MACHINE_ID);
    }

    @Test
    void addInstalledAgent_existingAgent_versionUpdatedAndDeliveryCompleted() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(installedAgentRepository.findByMachineIdAndAgentType(MACHINE_ID, AGENT_TYPE)).thenReturn(Optional.of(existing));

        // execution
        service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false);

        // verifications
        assertThat(existing.getVersion()).isEqualTo(VERSION);
        assertThat(existing.getStatus()).isEqualTo(ConnectionStatus.CONNECTED);
        verify(installedAgentRepository).save(existing);
        verify(deliveryTracker).complete(DeliveryKind.TOOL_INSTALLATION, AGENT_TYPE, MACHINE_ID);
    }

    @Test
    void addInstalledAgent_unknownMachine_throwsAndDeliveryUntouched() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        MachineNotFoundException ex = assertThrows(MachineNotFoundException.class,
                () -> service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false));

        // verifications
        assertThat(ex.getMessage()).contains(MACHINE_ID);
        verifyNoInteractions(deliveryTracker);
    }
}
