package com.openframe.client.service;

import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InstalledAgentServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String AGENT_TYPE = "openframe-client";
    private static final String VERSION = "1.6.23";

    @Mock
    private InstalledAgentRepository installedAgentRepository;

    @Mock
    private MachineRepository machineRepository;

    @Captor
    private ArgumentCaptor<InstalledAgent> installedAgentCaptor;

    @InjectMocks
    private InstalledAgentService service;

    @Test
    void reproducesBug_CU17tkuw65zpy_addInstalledAgent_machineNotYetOnSecondary_agentSaved() {
        // setup
        when(machineRepository.existsByMachineId(MACHINE_ID)).thenReturn(true);
        when(installedAgentRepository.findByMachineIdAndAgentType(MACHINE_ID, AGENT_TYPE)).thenReturn(Optional.empty());

        // execution
        service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false);

        // verifications
        verify(installedAgentRepository).save(installedAgentCaptor.capture());
        assertThat(installedAgentCaptor.getValue())
                .extracting(InstalledAgent::getMachineId, InstalledAgent::getAgentType, InstalledAgent::getVersion, InstalledAgent::getStatus)
                .containsExactly(MACHINE_ID, AGENT_TYPE, VERSION, ConnectionStatus.CONNECTED);
    }

    @Test
    void addInstalledAgent_machineMissing_throwsMachineNotFound() {
        // setup
        when(machineRepository.existsByMachineId(MACHINE_ID)).thenReturn(false);

        // execution
        MachineNotFoundException ex = assertThrows(MachineNotFoundException.class,
                () -> service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Machine not found: " + MACHINE_ID);
        verify(installedAgentRepository, never()).save(any(InstalledAgent.class));
    }
}
